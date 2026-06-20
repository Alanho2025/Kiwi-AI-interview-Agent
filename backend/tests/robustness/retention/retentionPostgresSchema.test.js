import { describe, expect, it, vi } from 'vitest';
import { RETENTION_POSTGRES_SCHEMA_STATEMENTS } from '../../../src/config/retentionPostgresSchemaStatements.js';
import { initializeRetentionSchema } from '../../../src/db/initializeRetentionSchema.js';

describe('retention PostgreSQL schema', () => {
  it('contains only retention DDL/backfill and no unrelated cleanup deletes', () => {
    const sql = RETENTION_POSTGRES_SCHEMA_STATEMENTS.join('\n').toUpperCase();
    expect(sql).toContain('RETENTION_CLEANUP_JOBS');
    expect(sql).toContain('UPDATED_AT');
    expect(sql).not.toContain('DELETE FROM');
  });

  it('applies only the dedicated retention statements', async () => {
    const runQuery = vi.fn(async () => ({}));
    await initializeRetentionSchema({ runQuery });
    expect(runQuery).toHaveBeenCalledTimes(RETENTION_POSTGRES_SCHEMA_STATEMENTS.length);
  });
});
