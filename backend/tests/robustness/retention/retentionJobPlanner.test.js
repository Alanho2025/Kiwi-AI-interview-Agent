import { describe, expect, it } from 'vitest';
import { buildRetentionJobs } from '../../../src/services/retention/retentionJobPlanner.js';

describe('retentionJobPlanner', () => {
  it('groups cross-store session candidates into one short Saga job', () => {
    const jobs = buildRetentionJobs({
      mongo: [
        { collection: 'sessionanalyses', id: 'analysis-1', sessionId: 'session-1' },
        { collection: 'sessiontranscripts', id: 'transcript-1', sessionId: 'session-1' },
      ],
      postgres: [{ table: 'interview_sessions', id: 'session-1' }],
      filePathsByResourceId: { 'session-1': ['/uploads/recording.wav'] },
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      resourceType: 'session',
      resourceId: 'session-1',
      filePaths: ['/uploads/recording.wav'],
    });
    expect(jobs[0].candidateManifest.mongo).toHaveLength(2);
    expect(jobs[0].candidateManifest.postgres).toHaveLength(1);
  });

  it('keeps global knowledge out even if a malformed manifest contains it', () => {
    expect(() => buildRetentionJobs({
      mongo: [{ collection: 'documentchunks', id: 'global-1', sessionId: null }],
      postgres: [{ table: 'document_chunks', id: 'global-2', sessionId: null }],
    })).toThrow('Global knowledge cannot be scheduled');
  });

  it('orders session jobs before file jobs so references are removed first', () => {
    const jobs = buildRetentionJobs({
      mongo: [{ collection: 'documentcontents', id: 'content-1', fileId: 'file-1' }],
      postgres: [
        { table: 'uploaded_files', id: 'file-1' },
        { table: 'interview_sessions', id: 'session-1' },
      ],
      filePathsByResourceId: { 'file-1': ['/uploads/cv.pdf'] },
    });

    expect(jobs.map((job) => job.resourceType)).toEqual(['session', 'file']);
  });
});
