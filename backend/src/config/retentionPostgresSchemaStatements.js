export const RETENTION_POSTGRES_TABLE_STATEMENTS = [
  `ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS last_used_at timestamptz`,
  `ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS expires_at timestamptz`,
  `ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS updated_at timestamptz`,
  `UPDATE uploaded_files
   SET last_used_at = COALESCE(last_used_at, uploaded_at),
       expires_at = COALESCE(expires_at, COALESCE(last_used_at, uploaded_at) + interval '7 days')
   WHERE last_used_at IS NULL OR expires_at IS NULL`,
  `UPDATE interview_sessions
   SET data_retention_days = 7,
       expires_at = updated_at + interval '7 days'
   WHERE data_retention_days IS DISTINCT FROM 7
      OR expires_at IS DISTINCT FROM updated_at + interval '7 days'`,
  `CREATE TABLE IF NOT EXISTS retention_cleanup_jobs (
    id uuid PRIMARY KEY,
    run_id varchar(100) NOT NULL,
    resource_type varchar(50) NOT NULL,
    resource_id varchar(255) NOT NULL,
    state varchar(50) NOT NULL,
    cutoff_at timestamptz NOT NULL,
    candidate_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    file_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
    quarantined_files jsonb NOT NULL DEFAULT '[]'::jsonb,
    mongo_result jsonb,
    postgres_result jsonb,
    file_result jsonb,
    attempt_count integer NOT NULL DEFAULT 0,
    last_error text,
    next_retry_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(run_id, resource_type, resource_id)
  )`,
];

export const RETENTION_POSTGRES_INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_interview_sessions_expires_at
   ON interview_sessions(expires_at)
   WHERE expires_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_uploaded_files_expires_at
   ON uploaded_files(expires_at)
   WHERE expires_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_retention_cleanup_jobs_state_retry
   ON retention_cleanup_jobs(state, next_retry_at, created_at)`,
];

export const RETENTION_POSTGRES_SCHEMA_STATEMENTS = [
  ...RETENTION_POSTGRES_TABLE_STATEMENTS,
  ...RETENTION_POSTGRES_INDEX_STATEMENTS,
];
