import { RETENTION_POSTGRES_SCHEMA_STATEMENTS } from '../config/retentionPostgresSchemaStatements.js';
import { query } from './postgres.js';

export const initializeRetentionSchema = async ({ runQuery = query } = {}) => {
  for (const statement of RETENTION_POSTGRES_SCHEMA_STATEMENTS) {
    await runQuery(statement);
  }
};
