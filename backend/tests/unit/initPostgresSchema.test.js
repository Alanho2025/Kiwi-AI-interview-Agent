import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the postgres query function
const mockQuery = vi.fn();
vi.mock('../../src/db/postgres.js', () => ({
    query: mockQuery,
}));

const { initPostgresSchema } = await import('../../src/db/initPostgresSchema.js');

describe('initPostgresSchema', () => {
    beforeEach(() => {
        mockQuery.mockClear();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('schema initialization', () => {
        it('should execute all schema statements in order', async () => {
            await initPostgresSchema();

            expect(mockQuery).toHaveBeenCalled();
            expect(mockQuery.mock.calls.length).toBeGreaterThan(0);
        });

        it('should create vector extension', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE EXTENSION IF NOT EXISTS vector'))).toBe(true);
        });

        it('should create document_chunks table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS document_chunks'))).toBe(true);
        });

        it('should create users table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS users'))).toBe(true);
        });

        it('should create interview_sessions table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS interview_sessions'))).toBe(true);
        });

        it('should create uploaded_files table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS uploaded_files'))).toBe(true);
        });

        it('should create job_description_inputs table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS job_description_inputs'))).toBe(true);
        });

        it('should create parsed_profiles table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS parsed_profiles'))).toBe(true);
        });

        it('should create parsed_skills table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS parsed_skills'))).toBe(true);
        });

        it('should create interview_questions table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS interview_questions'))).toBe(true);
        });

        it('should create interview_responses table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS interview_responses'))).toBe(true);
        });

        it('should create report_summaries table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS report_summaries'))).toBe(true);
        });

        it('should create user_consents table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS user_consents'))).toBe(true);
        });

        it('should create audit_logs table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS audit_logs'))).toBe(true);
        });

        it('should create deletion_requests table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS deletion_requests'))).toBe(true);
        });

        it('should create data_access_grants table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS data_access_grants'))).toBe(true);
        });

        it('should create retention cleanup jobs table', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS retention_cleanup_jobs'))).toBe(true);
        });
    });

    describe('indexes', () => {
        it('should create interview_sessions indexes', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('idx_interview_sessions_user_created_at'))).toBe(true);
            expect(calls.some(sql => sql.includes('idx_interview_sessions_status_created_at'))).toBe(true);
        });

        it('should create uploaded_files indexes', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('idx_uploaded_files_user_role_uploaded_at'))).toBe(true);
        });

        it('should create parsed_skills indexes', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('idx_parsed_skills_session_source'))).toBe(true);
            expect(calls.some(sql => sql.includes('idx_parsed_skills_skill_name'))).toBe(true);
        });

        it('should create interview_responses indexes', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('idx_interview_responses_session_question'))).toBe(true);
        });

        it('should create audit_logs indexes', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('idx_audit_logs_session_created_at'))).toBe(true);
        });

        it('should create document_chunks indexes', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('idx_document_chunks_session_source'))).toBe(true);
            expect(calls.some(sql => sql.includes('idx_document_chunks_metadata_source_id'))).toBe(true);
            expect(calls.some(sql => sql.includes('idx_document_chunks_unique_source_chunk'))).toBe(true);
        });

        it('should create retention cleanup indexes', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('idx_retention_cleanup_jobs_state_retry'))).toBe(true);
            expect(calls.some(sql => sql.includes('idx_interview_sessions_expires_at'))).toBe(true);
            expect(calls.some(sql => sql.includes('idx_uploaded_files_expires_at'))).toBe(true);
        });

        it('should create vector index with fallback', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            const hasVectorIndex = calls.some(sql =>
                sql.includes('idx_document_chunks_embedding_hnsw') ||
                sql.includes('idx_document_chunks_embedding_ivfflat')
            );
            expect(hasVectorIndex).toBe(true);
        });
    });

    describe('schema migrations', () => {
        it('should alter interview_sessions mode default', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ALTER TABLE interview_sessions') &&
                sql.includes('mode SET DEFAULT')
            )).toBe(true);
        });

        it('should add control_mode column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS control_mode')
            )).toBe(true);
        });

        it('should add question_type column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS question_type')
            )).toBe(true);
        });

        it('should add question_limit column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS question_limit')
            )).toBe(true);
        });

        it('should add time_limit_seconds column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS time_limit_seconds')
            )).toBe(true);
        });

        it('should add completed_because column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS completed_because')
            )).toBe(true);
        });

        it('should alter interview_responses response_mode default', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ALTER TABLE interview_responses') &&
                sql.includes('response_mode SET DEFAULT')
            )).toBe(true);
        });

        it('should add audio_storage_key column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS audio_storage_key')
            )).toBe(true);
        });

        it('should add asr_provider column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS asr_provider')
            )).toBe(true);
        });

        it('should add asr_language column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS asr_language')
            )).toBe(true);
        });

        it('should add asr_confidence column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS asr_confidence')
            )).toBe(true);
        });

        it('should add provider_payload column if not exists', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ADD COLUMN IF NOT EXISTS provider_payload')
            )).toBe(true);
        });

        it('should alter uploaded_files is_encrypted default', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ALTER TABLE uploaded_files') &&
                sql.includes('is_encrypted SET DEFAULT')
            )).toBe(true);
        });

        it('should alter uploaded_files virus_scan_status default', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ALTER TABLE uploaded_files') &&
                sql.includes('virus_scan_status SET DEFAULT')
            )).toBe(true);
        });

        it('should add uploaded file retention columns', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql => sql.includes('ADD COLUMN IF NOT EXISTS last_used_at'))).toBe(true);
            expect(calls.some(sql => sql.includes('ADD COLUMN IF NOT EXISTS expires_at'))).toBe(true);
            expect(calls.some(sql => sql.includes('ADD COLUMN IF NOT EXISTS updated_at'))).toBe(true);
        });
    });

    describe('data cleanup', () => {
        it('should delete duplicate document_chunks', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('DELETE FROM document_chunks newer') &&
                sql.includes('USING document_chunks older')
            )).toBe(true);
        });
    });

    describe('vector type migration', () => {
        it('should check and migrate embedding column type', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            expect(calls.some(sql =>
                sql.includes('ALTER TABLE document_chunks') &&
                sql.includes('ALTER COLUMN embedding TYPE vector(256)')
            )).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should propagate query errors', async () => {
            const testError = new Error('Database connection failed');
            mockQuery.mockRejectedValueOnce(testError);

            await expect(initPostgresSchema()).rejects.toThrow('Database connection failed');
        });

        it('should stop execution on first error', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockRejectedValueOnce(new Error('Query failed'));

            await expect(initPostgresSchema()).rejects.toThrow('Query failed');
            expect(mockQuery).toHaveBeenCalledTimes(2);
        });
    });

    describe('statement execution order', () => {
        it('should execute extension creation before table creation', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            const extensionIndex = calls.findIndex(sql => sql.includes('CREATE EXTENSION'));
            const tableIndex = calls.findIndex(sql => sql.includes('CREATE TABLE'));

            expect(extensionIndex).toBeLessThan(tableIndex);
        });

        it('should execute table creation before index creation', async () => {
            await initPostgresSchema();

            const calls = mockQuery.mock.calls.map(call => call[0]);
            const lastTableIndex = calls.map((sql, i) => sql.includes('CREATE TABLE') ? i : -1)
                .filter(i => i >= 0)
                .pop();
            const firstIndexIndex = calls.findIndex(sql => sql.includes('CREATE INDEX'));

            expect(lastTableIndex).toBeLessThan(firstIndexIndex);
        });
    });
});

// Made with Bob
