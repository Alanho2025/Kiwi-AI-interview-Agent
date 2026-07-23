import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CompanyValuesProfile } from '../../../src/db/models/companyValuesProfileModel.js';
import { InterviewQuestionPoolItem } from '../../../src/db/models/interviewQuestionPoolItemModel.js';
import { MatchAnalysisRecord } from '../../../src/db/models/matchAnalysisRecordModel.js';
import { SessionAnalysis } from '../../../src/db/models/sessionAnalysisModel.js';
import { SessionReport } from '../../../src/db/models/sessionReportModel.js';
import { buildMongoRetentionModelRegistry } from '../../../src/repositories/mongoRetentionModelRegistry.js';

const backendRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

const expectPrivateRetentionContract = (model) => {
  expect(model.schema.path('retentionUntil')).toBeTruthy();
  expect(model.schema.path('deletedAt')).toBeTruthy();
  expect(model.schema.path('containsSensitiveData')?.defaultValue).toBe(true);
  expect(model.schema.path('accessScope')?.defaultValue).toBe('private');
};

describe('role-fit cutover and retention contract', () => {
  it('stores all Role-Fit-bearing runtime documents under the private retention contract', () => {
    for (const model of [CompanyValuesProfile, InterviewQuestionPoolItem, MatchAnalysisRecord, SessionAnalysis, SessionReport]) {
      expectPrivateRetentionContract(model);
    }

    expect(CompanyValuesProfile.schema.path('userId')).toBeTruthy();
    expect(InterviewQuestionPoolItem.schema.path('userId')).toBeTruthy();
    expect(MatchAnalysisRecord.schema.path('performanceTrace')).toBeTruthy();
    expect(SessionAnalysis.schema.path('userId')).toBeTruthy();
    expect(SessionReport.schema.path('userId')).toBeTruthy();
    expect(SessionAnalysis.schema.path('roleEvidenceMap')).toBeTruthy();
  });

  it('registers every Role-Fit-bearing collection with retention cleanup', () => {
    const registry = buildMongoRetentionModelRegistry();

    for (const collectionName of [
      'companyvaluesprofiles',
      'interviewplans',
      'interviewquestionpoolitems',
      'matchanalysisrecords',
      'sessionanalyses',
      'sessionreports',
    ]) {
      expect(registry.has(collectionName)).toBe(true);
    }
  });

  it('defaults all newly-created prepared question items to v3', () => {
    expect(InterviewQuestionPoolItem.schema.path('schemaVersion').defaultValue).toBe('v3');
  });

  it('has no production kill-switch flag or legacy-reviewed-JD entrypoint after cutover', () => {
    const source = [
      read('src/services/match/guardedMatchService.js'),
      read('src/services/cv/cvAnalysisService.js'),
    ].join('\n');

    expect(source).not.toContain('legacy_reviewed_jd');
    expect(source).not.toContain('ROLE_FIT_REPLACEMENT_KILL_SWITCH');
    expect(source).not.toContain('ROLE_FIT_LEGACY_READER_ENABLED');
  });
});
