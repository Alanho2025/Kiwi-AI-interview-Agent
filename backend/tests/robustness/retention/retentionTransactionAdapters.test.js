import { describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { runTransactionWithClient } from '../../../src/db/postgres.js';
import { createMongoRetentionRepository } from '../../../src/repositories/mongoRetentionRepository.js';

describe('retention transaction adapters', () => {
  it('rolls back PostgreSQL when a child deletion fails', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('child delete failed'))
        .mockResolvedValueOnce({}),
    };

    await expect(runTransactionWithClient(client, async (transactionClient) => {
      await transactionClient.query('DELETE FROM interview_responses WHERE session_id = $1', ['session-1']);
    })).rejects.toThrow('child delete failed');

    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'DELETE FROM interview_responses WHERE session_id = $1',
      'ROLLBACK',
    ]);
  });

  it('passes one Mongo session to every collection delete and aborts on failure', async () => {
    const transactionSession = { id: 'mongo-session' };
    const firstModel = { deleteMany: vi.fn(async () => ({ deletedCount: 2 })) };
    const secondModel = { deleteMany: vi.fn(async () => { throw new Error('mongo delete failed'); }) };
    const connection = {
      transaction: vi.fn(async (callback) => callback(transactionSession)),
    };
    const repository = createMongoRetentionRepository({
      connection,
      modelsByCollection: new Map([
        ['sessionanalyses', firstModel],
        ['sessiontranscripts', secondModel],
      ]),
    });

    await expect(repository.deleteCandidatesInTransaction({
      candidates: [
        { collection: 'sessionanalyses', id: 'analysis-1', updatedAt: '2026-06-01T00:00:00.000Z' },
        { collection: 'sessiontranscripts', id: 'transcript-1', updatedAt: '2026-06-01T00:00:00.000Z' },
      ],
    })).rejects.toThrow('mongo delete failed');

    expect(firstModel.deleteMany).toHaveBeenCalledWith(expect.any(Object), { session: transactionSession });
    expect(secondModel.deleteMany).toHaveBeenCalledWith(expect.any(Object), { session: transactionSession });
    expect(connection.transaction).toHaveBeenCalledTimes(1);
  });

  it('converts audited ObjectId strings back to ObjectId values before deletion', async () => {
    const id = new ObjectId();
    const model = { deleteMany: vi.fn(async () => ({ deletedCount: 1 })) };
    const connection = {
      transaction: vi.fn(async (callback) => callback({ id: 'mongo-session' })),
    };
    const repository = createMongoRetentionRepository({
      connection,
      modelsByCollection: new Map([['sessionanalyses', model]]),
    });

    await repository.deleteCandidatesInTransaction({
      candidates: [{
        collection: 'sessionanalyses',
        id: id.toHexString(),
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
    });

    const filter = model.deleteMany.mock.calls[0][0];
    expect(filter.$or[0]._id).toBeInstanceOf(ObjectId);
    expect(filter.$or[0]._id.toHexString()).toBe(id.toHexString());
  });
});
