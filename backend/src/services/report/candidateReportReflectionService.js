import crypto from 'node:crypto';

import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';

const MAX_REFLECTION_LENGTH = 800;
const REFLECTION_FOCUS_AREAS = new Set(['scope', 'evidence', 'verification', 'structure', 'communication', 'other']);

const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

export const normalizeCandidateReflection = ({ reflection = '', focusArea = 'other' } = {}) => {
  const text = normalizeText(reflection);
  if (!text) throw new Error('A reflection is required');
  if (text.length > MAX_REFLECTION_LENGTH) throw new Error(`Reflection must be ${MAX_REFLECTION_LENGTH} characters or fewer`);
  return {
    reflectionId: crypto.randomUUID(),
    text,
    focusArea: REFLECTION_FOCUS_AREAS.has(focusArea) ? focusArea : 'other',
    source: 'candidate_provided',
    submittedAt: new Date().toISOString(),
  };
};

export const listCandidateReflections = async ({ sessionId, model = SessionAnalysis } = {}) => {
  if (!sessionId) return [];
  const record = await model.findOne({ sessionId }).lean();
  return Array.isArray(record?.candidateReflectionRecords)
    ? record.candidateReflectionRecords.slice(-5)
    : [];
};

export const saveCandidateReflection = async ({ sessionId, reflection, focusArea, model = SessionAnalysis } = {}) => {
  if (!sessionId) throw new Error('A session is required');
  const entry = normalizeCandidateReflection({ reflection, focusArea });
  await model.findOneAndUpdate(
    { sessionId },
    { $push: { candidateReflectionRecords: { $each: [entry], $slice: -5 } } },
    { new: true, upsert: false },
  );
  return entry;
};
