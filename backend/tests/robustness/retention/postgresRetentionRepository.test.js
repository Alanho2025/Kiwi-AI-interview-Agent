import { describe, expect, it, vi } from 'vitest';
import { createPostgresRetentionRepository } from '../../../src/repositories/postgresRetentionRepository.js';

const expectedUpdatedAt = '2026-06-01T00:00:00.000Z';

describe('postgresRetentionRepository', () => {
  it('deletes session children and only session-scoped chunks in one transaction', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'session-1', updated_at: new Date(expectedUpdatedAt) }] })
        .mockResolvedValue({ rowCount: 1, rows: [] }),
    };
    const runInTransaction = vi.fn(async (callback) => callback(client));
    const repository = createPostgresRetentionRepository({ runInTransaction });

    const result = await repository.deleteCandidatesInTransaction({
      candidates: [{ table: 'interview_sessions', id: 'session-1', updatedAt: expectedUpdatedAt }],
    });

    expect(result).toEqual({ deletedCount: 1, skippedCount: 0 });
    const statements = client.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').trim());
    expect(statements).toContain('DELETE FROM document_chunks WHERE session_id = $1');
    expect(statements).not.toContain('DELETE FROM document_chunks WHERE session_id IS NULL');
    expect(statements.at(-1)).toBe('DELETE FROM interview_sessions WHERE id = $1');
  });

  it('skips deletion when the audited timestamp no longer matches', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 'session-1', updated_at: new Date('2026-06-15T00:00:00.000Z') }],
      }),
    };
    const repository = createPostgresRetentionRepository({
      runInTransaction: async (callback) => callback(client),
    });

    const result = await repository.deleteCandidatesInTransaction({
      candidates: [{ table: 'interview_sessions', id: 'session-1', updatedAt: expectedUpdatedAt }],
    });

    expect(result).toEqual({ deletedCount: 0, skippedCount: 1 });
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('rejects tables that are not explicitly supported', async () => {
    const repository = createPostgresRetentionRepository({ runInTransaction: vi.fn() });

    await expect(repository.deleteCandidatesInTransaction({
      candidates: [{ table: 'users', id: 'user-1', updatedAt: expectedUpdatedAt }],
    })).rejects.toThrow('Unsupported PostgreSQL retention table');
  });

  it('deletes an expired uploaded file only when no session still references it', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'file-1', updated_at: new Date(expectedUpdatedAt) }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
    };
    const repository = createPostgresRetentionRepository({
      runInTransaction: async (callback) => callback(client),
    });

    const result = await repository.deleteCandidatesInTransaction({
      candidates: [{
        table: 'uploaded_files',
        id: 'file-1',
        updatedAt: expectedUpdatedAt,
      }],
    });

    expect(result).toEqual({ deletedCount: 1, skippedCount: 0 });
    expect(client.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').trim())).toContain(
      'SELECT COUNT(*)::bigint AS count FROM interview_sessions WHERE cv_file_id = $1',
    );
  });

  it('keeps an uploaded file while any session still references it', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'file-1', updated_at: new Date(expectedUpdatedAt) }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }),
    };
    const repository = createPostgresRetentionRepository({
      runInTransaction: async (callback) => callback(client),
    });

    const result = await repository.deleteCandidatesInTransaction({
      candidates: [{
        table: 'uploaded_files',
        id: 'file-1',
        updatedAt: expectedUpdatedAt,
      }],
    });

    expect(result).toEqual({ deletedCount: 0, skippedCount: 1 });
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it('skips an uploaded file whose own audited timestamp changed', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 'file-1', updated_at: new Date('2026-06-15T00:00:00.000Z') }],
      }),
    };
    const repository = createPostgresRetentionRepository({
      runInTransaction: async (callback) => callback(client),
    });

    const result = await repository.deleteCandidatesInTransaction({
      candidates: [{ table: 'uploaded_files', id: 'file-1', updatedAt: expectedUpdatedAt }],
    });

    expect(result).toEqual({ deletedCount: 0, skippedCount: 1 });
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
