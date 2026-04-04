import { query } from './postgres.js';

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255) NOT NULL,
    auth_provider varchar(50) NOT NULL,
    google_sub varchar(255) UNIQUE,
    privacy_policy_version varchar(50),
    terms_accepted_at timestamptz,
    marketing_consent boolean NOT NULL DEFAULT false,
    analytics_consent boolean NOT NULL DEFAULT false,
    consent_updated_at timestamptz,
    account_status varchar(50) NOT NULL DEFAULT 'active',
    last_login_at timestamptz,
    deleted_at timestamptz,
    anonymized_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS interview_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    status varchar(50) NOT NULL,
    mode varchar(50) NOT NULL DEFAULT 'voice',
    target_role varchar(255),
    candidate_name varchar(255),
    seniority_level varchar(100),
    focus_area varchar(100),
    enable_nz_culture_fit boolean NOT NULL DEFAULT false,
    current_question_index integer NOT NULL DEFAULT 0,
    total_questions integer NOT NULL DEFAULT 0,
    elapsed_seconds integer NOT NULL DEFAULT 0,
    last_resumed_at timestamptz,
    started_at timestamptz,
    ended_at timestamptz,
    duration_seconds integer,
    overall_score numeric(5,2),
    summary_text text,
    data_retention_days integer,
    expires_at timestamptz,
    contains_sensitive_data boolean NOT NULL DEFAULT true,
    deletion_requested_at timestamptz,
    deleted_at timestamptz,
    anonymized_at timestamptz,
    cv_file_id uuid,
    jd_file_id uuid,
    report_file_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS uploaded_files (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    session_id uuid REFERENCES interview_sessions(id),
    file_role varchar(100) NOT NULL,
    original_filename varchar(255) NOT NULL,
    mime_type varchar(255) NOT NULL,
    storage_provider varchar(100) NOT NULL,
    storage_key varchar(500) NOT NULL,
    file_url text,
    file_size_bytes bigint NOT NULL,
    checksum varchar(255),
    is_encrypted boolean NOT NULL DEFAULT true,
    encryption_key_ref varchar(255),
    virus_scan_status varchar(50) NOT NULL DEFAULT 'pending',
    virus_scanned_at timestamptz,
    access_scope varchar(50) NOT NULL DEFAULT 'private',
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS job_description_inputs (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL UNIQUE REFERENCES interview_sessions(id),
    source_type varchar(100) NOT NULL,
    raw_text text,
    redacted_text text,
    contains_pii boolean NOT NULL DEFAULT false,
    uploaded_file_id uuid REFERENCES uploaded_files(id),
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS parsed_profiles (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL UNIQUE REFERENCES interview_sessions(id),
    candidate_name varchar(255),
    current_title varchar(255),
    experience_years numeric(4,1),
    highest_education varchar(255),
    location varchar(255),
    job_title varchar(255),
    cv_summary text,
    jd_summary text,
    match_score numeric(5,2),
    profile_source_version varchar(50),
    is_redacted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS parsed_skills (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES interview_sessions(id),
    source_type varchar(50) NOT NULL,
    skill_name varchar(255) NOT NULL,
    skill_category varchar(100),
    importance_level varchar(50),
    evidence_text text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS interview_questions (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES interview_sessions(id),
    question_order integer NOT NULL,
    question_type varchar(100) NOT NULL,
    source_type varchar(100) NOT NULL,
    question_text text NOT NULL,
    based_on_cv boolean NOT NULL DEFAULT false,
    based_on_jd boolean NOT NULL DEFAULT false,
    asked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(session_id, question_order)
  )`,
  `CREATE TABLE IF NOT EXISTS interview_responses (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES interview_sessions(id),
    question_id uuid NOT NULL REFERENCES interview_questions(id),
    response_mode varchar(50) NOT NULL DEFAULT 'voice',
    transcript_text text,
    redacted_transcript_text text,
    contains_sensitive_data boolean NOT NULL DEFAULT true,
    audio_duration_seconds integer,
    response_started_at timestamptz,
    response_ended_at timestamptz,
    word_count integer,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS report_summaries (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL UNIQUE REFERENCES interview_sessions(id),
    overall_score numeric(5,2),
    communication_score numeric(5,2),
    technical_score numeric(5,2),
    confidence_score numeric(5,2),
    job_fit_score numeric(5,2),
    overall_impression text,
    strengths_summary text,
    gaps_summary text,
    suggestions_summary text,
    is_shareable boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS user_consents (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    consent_type varchar(100) NOT NULL,
    status boolean NOT NULL,
    policy_version varchar(50),
    captured_at timestamptz NOT NULL DEFAULT now(),
    source varchar(100)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY,
    actor_user_id uuid REFERENCES users(id),
    target_user_id uuid REFERENCES users(id),
    session_id uuid REFERENCES interview_sessions(id),
    action_type varchar(100) NOT NULL,
    resource_type varchar(100) NOT NULL,
    resource_id varchar(255) NOT NULL,
    status varchar(50) NOT NULL,
    ip_address inet,
    user_agent text,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS deletion_requests (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    resource_type varchar(100) NOT NULL,
    resource_id varchar(255) NOT NULL,
    status varchar(50) NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    reason varchar(255)
  )`,
  `CREATE TABLE IF NOT EXISTS data_access_grants (
    id uuid PRIMARY KEY,
    actor_user_id uuid NOT NULL REFERENCES users(id),
    target_user_id uuid NOT NULL REFERENCES users(id),
    resource_scope varchar(100) NOT NULL,
    granted_reason text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_created_at
    ON interview_sessions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_interview_sessions_status_created_at
    ON interview_sessions(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_role_uploaded_at
    ON uploaded_files(user_id, file_role, uploaded_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_parsed_skills_session_source
    ON parsed_skills(session_id, source_type)`,
  `CREATE INDEX IF NOT EXISTS idx_parsed_skills_skill_name
    ON parsed_skills(skill_name)`,
  `CREATE INDEX IF NOT EXISTS idx_interview_responses_session_question
    ON interview_responses(session_id, question_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_session_created_at
    ON audit_logs(session_id, created_at DESC)`,
];

export const initPostgresSchema = async () => {
  for (const statement of statements) {
    await query(statement);
  }
};
