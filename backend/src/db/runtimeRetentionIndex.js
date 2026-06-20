import { RETENTION_DAYS } from '../config/retentionConfig.js';

export const applyRuntimeRetentionIndex = (schema) => {
  schema.index(
    { updatedAt: 1 },
    {
      expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60,
      name: 'ttl_runtime_updated_at',
    },
  );
  return schema;
};
