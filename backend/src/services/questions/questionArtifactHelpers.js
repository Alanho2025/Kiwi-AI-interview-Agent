import crypto from 'crypto';
import { ensureArray, normalizeKey, normalizeText, tokenize, unique } from '../../utils/commonHelpers.js';

import { buildRetentionExpiry } from '../retention/retentionPolicy.js';

export const questionRetentionDate = () => buildRetentionExpiry();

export const clampWeight = (value, fallback = 0.5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

export const stableQuestionId = (prefix, parts = []) => {
  const normalized = parts.map((part) => normalizeKey(part).replace(/[^a-z0-9]+/g, '-')).filter(Boolean).join('|');
  const hash = crypto.createHash('sha1').update(normalized || crypto.randomUUID()).digest('hex').slice(0, 12);
  return `${prefix}_${hash}`;
};

export const normalizeTopicKey = (value = '') => tokenize(value).slice(0, 8).join(' ');

export const compactEvidenceRefs = (items = []) => ensureArray(items)
  .slice(0, 4)
  .map((item) => {
    if (typeof item === 'string') return { text: item.slice(0, 220) };
    return {
      sourceType: item?.sourceType || item?.type || '',
      projectTitle: item?.projectTitle || item?.title || '',
      text: normalizeText(item?.summary || item?.text || item?.evidence || '').slice(0, 220),
    };
  })
  .filter((item) => item.text || item.projectTitle || item.sourceType);

export const extractTextList = (...values) => unique(values.flatMap((value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      return item?.label || item?.name || item?.title || item?.skill || item?.requirement || item?.text || item?.summary || '';
    });
  }
  if (typeof value === 'object') {
    return [value.label, value.name, value.title, value.skill, value.requirement, value.text, value.summary].filter(Boolean);
  }
  return [value];
}));

export const buildModeCompatibility = (category = '') => {
  const normalizedCategory = normalizeKey(category);
  return {
    technical: ['technical', 'role_competency', 'closing', 'opening', 'motivation'].includes(normalizedCategory),
    behavioural: ['behavioural', 'behavioral', 'closing', 'opening', 'motivation'].includes(normalizedCategory),
    combined: true,
  };
};

export const normalizeCategory = (value = '') => {
  const key = normalizeKey(value);
  if (key === 'behavioral') return 'behavioural';
  if (key.includes('behaviour')) return 'behavioural';
  if (key.includes('technical')) return 'technical';
  if (key.includes('opening')) return 'opening';
  if (key.includes('motivation')) return 'motivation';
  if (key.includes('closing') || key.includes('wrap')) return 'closing';
  if (key.includes('role')) return 'role_competency';
  return key || 'experience';
};

const DOMAIN_TERM_PATTERN = /\b(?:[A-Z0-9]+(?:\/[A-Z0-9]+)+|[A-Z][A-Za-z0-9]*\.?[A-Za-z0-9]*|[A-Za-z]+(?:\.(?:js|ts)|JS|TS)|[A-Za-z]+(?:SQL|API|SDK|AI|ML|UI|UX|DB|EC2|RDS|S3|IAM|VAD|TTS|STT|BPMN|UML|UAT|BRD|FRD|MECE|SWOT|PESTEL|KPI|OKR|CAC|LTV|ROAS|CTR|SEO|SEM|GA4|NPS|NCEA|NZC|IEP|ERA|AML|CFT|NZLS|ETL|ELT)|[A-Za-z]+(?:[- ][A-Za-z0-9]+){1,3})\b/gi;

const inferTermReason = (phrase = '', fallback = 'domain_term') => {
  if (/\b(?:CI\/CD|STT\/TTS|[A-Z]{2,}\b|\bEC2\b|\bRDS\b|\bS3\b|\bIAM\b|\bVAD\b|\bBPMN\b|\bUML\b|\bUAT\b|\bBRD\b|\bFRD\b|\bMECE\b|\bSWOT\b|\bPESTEL\b|\bKPI\b|\bOKR\b|\bCAC\b|\bLTV\b|\bROAS\b|\bCTR\b|\bSEO\b|\bSEM\b|\bGA4\b|\bNPS\b|\bNCEA\b|\bNZC\b|\bIEP\b|\bERA\b|\bAML\/CFT\b|\bNZLS\b|\bETL\b|\bELT\b)\b/i.test(phrase)) return 'technical_acronym';
  if (/\b(?:SQL|API|SDK|AI|ML|UI|UX|DB|GA4|PowerBI|Tableau|PySpark|Polars|Pandas)\b/i.test(phrase) || /\.(?:js|ts)$/i.test(phrase) || /\b(?:WebSocket|WebSockets|TypeScript|LangChain|Docker|PostgreSQL|Render|Databricks|XGBoost|MoSCoW|McKinsey|Porter|Google Analytics|Te Whāriki|Te Whariki)\b/i.test(phrase)) return 'tool_or_framework';
  if (/\b(?:certificate|certification|certified|degree|university)\b/i.test(phrase)) return 'certification';
  if (/^[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)+$/.test(phrase)) return 'proper_noun';
  return fallback;
};

export const buildTargetTechnicalTermItem = ({
  term = '',
  source = 'question_context',
  sourceRef = {},
  priority = 'high',
  reason = null,
  safeForPhraseHint = true,
  safeForAutoCorrection = true,
} = {}) => {
  const cleanTerm = String(term || '').trim();
  if (!cleanTerm) return null;
  const normalizedTerm = cleanTerm.toLowerCase();
  const resolvedReason = reason || inferTermReason(cleanTerm);
  return {
    term: cleanTerm,
    normalizedTerm,
    source: String(source || 'question_context'),
    sourceRef: {
      evidenceId: sourceRef?.evidenceId || null,
      questionId: sourceRef?.questionId || null,
      fieldPath: sourceRef?.fieldPath || null,
    },
    reason: resolvedReason,
    priority: String(priority || 'high'),
    safeForPhraseHint: Boolean(safeForPhraseHint),
    safeForAutoCorrection: Boolean(safeForAutoCorrection),
  };
};

export const extractTargetTechnicalTerms = ({
  questionText = '',
  topic = '',
  matchedSkill = '',
  basedOnSkills = [],
  evidenceRefs = [],
  analysisResult = {},
  questionId = null,
} = {}) => {
  const termsMap = new Map();

  const addTerm = (term, metadata = {}) => {
    const combinedSourceRef = {
      questionId,
      ...(metadata.sourceRef || {}),
    };
    const item = buildTargetTechnicalTermItem({
      term,
      ...metadata,
      sourceRef: combinedSourceRef,
    });
    if (!item || item.term.length < 2) return;
    const key = item.normalizedTerm;
    if (!termsMap.has(key)) {
      termsMap.set(key, item);
    }
  };

  if (matchedSkill) {
    addTerm(matchedSkill, { source: 'matched_skill', priority: 'high', sourceRef: { fieldPath: 'question.matchedSkill' } });
  }
  for (const skill of ensureArray(basedOnSkills)) {
    addTerm(skill, { source: 'based_on_skill', priority: 'high', sourceRef: { fieldPath: 'question.basedOnSkills' } });
  }
  if (topic) {
    addTerm(topic, { source: 'question_topic', priority: 'high', sourceRef: { fieldPath: 'question.topic' } });
  }

  const matches = String(questionText || '').match(DOMAIN_TERM_PATTERN) || [];
  for (const match of matches) {
    addTerm(match, { source: 'question_text', priority: 'high', sourceRef: { fieldPath: 'question.text' } });
  }

  for (const ref of ensureArray(evidenceRefs)) {
    const text = typeof ref === 'string' ? ref : (ref?.text || ref?.projectTitle || '');
    const refMatches = text.match(DOMAIN_TERM_PATTERN) || [];
    for (const match of refMatches) {
      addTerm(match, { source: 'candidate_evidence', priority: 'high', sourceRef: { evidenceId: ref?.id || ref?.evidenceId || null, fieldPath: 'question.evidenceRefs' } });
    }
  }

  const cvSkills = analysisResult?.parsedCvProfile?.skills || analysisResult?.parsedCvProfile?.technicalSkills || [];
  for (const skill of ensureArray(cvSkills)) {
    if (typeof skill === 'string' && (questionText.toLowerCase().includes(skill.toLowerCase()) || topic.toLowerCase().includes(skill.toLowerCase()))) {
      addTerm(skill, { source: 'candidate_evidence', priority: 'high', sourceRef: { fieldPath: 'parsedCvProfile.skills' } });
    }
  }

  return Array.from(termsMap.values());
};

