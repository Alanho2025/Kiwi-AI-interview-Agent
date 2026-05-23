import { query, withTransaction } from '../../src/db/postgres.js';
import { SessionTranscript } from '../../src/db/models/sessionTranscriptModel.js';

const postgresTables = [
  'interview_responses',
  'interview_questions',
  'interview_sessions',
];

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const fetchRows = async (tableName, sessionId) => {
  const result = await query(
    `SELECT * FROM ${tableName} WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows || [];
};

const fetchSessionRow = async (sessionId) => {
  const result = await query('SELECT * FROM interview_sessions WHERE id = $1 LIMIT 1', [sessionId]);
  return result.rows[0] || null;
};

const fetchTranscriptSnapshot = async (sessionId) => {
  const transcript = await SessionTranscript.findOne({ sessionId }).lean();
  return transcript ? cloneJson(transcript) : null;
};

export const createSessionBenchmarkSnapshot = async (sessionId) => ({
  sessionId,
  capturedAt: new Date().toISOString(),
  postgres: {
    interview_sessions: await fetchSessionRow(sessionId),
    interview_questions: await fetchRows('interview_questions', sessionId),
    interview_responses: await fetchRows('interview_responses', sessionId),
  },
  mongo: {
    sessionTranscript: await fetchTranscriptSnapshot(sessionId),
  },
});

const updateSessionRow = async (client, row) => {
  if (!row) return;
  const columns = Object.keys(row).filter((column) => column !== 'id');
  if (!columns.length) return;
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
  const values = columns.map((column) => row[column]);
  values.push(row.id);
  await client.query(
    `UPDATE interview_sessions SET ${assignments.join(', ')} WHERE id = $${values.length}`,
    values
  );
};

const insertRows = async (client, tableName, rows = []) => {
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const values = columns.map((column) => row[column]);
    await client.query(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );
  }
};

const restorePostgresSnapshot = async (snapshot) => {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM interview_responses WHERE session_id = $1', [snapshot.sessionId]);
    await client.query('DELETE FROM interview_questions WHERE session_id = $1', [snapshot.sessionId]);
    await updateSessionRow(client, snapshot.postgres.interview_sessions);
    await insertRows(client, 'interview_questions', snapshot.postgres.interview_questions);
    await insertRows(client, 'interview_responses', snapshot.postgres.interview_responses);
  });
};

const restoreTranscriptSnapshot = async (snapshot) => {
  await SessionTranscript.deleteOne({ sessionId: snapshot.sessionId });
  if (snapshot.mongo.sessionTranscript) {
    await SessionTranscript.create(snapshot.mongo.sessionTranscript);
  }
};

export const restoreSessionBenchmarkSnapshot = async (snapshot) => {
  if (!snapshot?.sessionId) return;
  await restorePostgresSnapshot(snapshot);
  await restoreTranscriptSnapshot(snapshot);
};

export const summarizeBenchmarkSnapshot = (snapshot) => ({
  sessionId: snapshot?.sessionId || null,
  capturedAt: snapshot?.capturedAt || null,
  restoredTables: postgresTables,
  questionCount: snapshot?.postgres?.interview_questions?.length || 0,
  responseCount: snapshot?.postgres?.interview_responses?.length || 0,
  transcriptTurnCount: snapshot?.mongo?.sessionTranscript?.turns?.length || 0,
});
