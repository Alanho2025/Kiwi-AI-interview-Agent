import { normalizeText } from '../../utils/commonHelpers.js';

/**
 * File responsibility: Classify spoken replies to transcript confirmation prompts.
 * Keep this deterministic for latency and reliability in the duplex voice loop.
 */

const CONFIRM_PATTERNS = [
  /\byes\b/,
  /\byeah\b/,
  /\byep\b/,
  /\bcorrect\b/,
  /\bright\b/,
  /\bthat's right\b/,
  /\bthat is right\b/,
  /\bexactly\b/,
  /\byou understood\b/,
  /\bunderstood correctly\b/,
];

const REJECT_PATTERNS = [
  /\bno\b/,
  /\bnope\b/,
  /\bnot exactly\b/,
  /\bnot really\b/,
  /\bwrong\b/,
  /\bincorrect\b/,
  /\blet me repeat\b/,
  /\brepeat\b/,
  /\bthat's not\b/,
  /\bthat is not\b/,
];

const CONFIRMATION_FILLER_PATTERNS = [
  /\bi think you (are|'re)? correct\b/gi,
  /\byou understood (it )?correctly\b/gi,
  /\byes\b/gi,
  /\byeah\b/gi,
  /\byep\b/gi,
  /\bcorrect\b/gi,
  /\bright\b/gi,
  /\bthat's right\b/gi,
  /\bthat is right\b/gi,
  /\bexactly\b/gi,
];

const countWords = (text = '') => String(text || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .length;

const extractExtraContent = (replyText = '') => {
  let extraText = String(replyText || '').trim();

  for (const pattern of CONFIRMATION_FILLER_PATTERNS) {
    extraText = extraText.replace(pattern, ' ');
  }

  extraText = extraText
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();

  return countWords(extraText) >= 6 ? extraText : '';
};

export const analyzeTranscriptConfirmationReply = (replyText = '') => {
  const clean = normalizeText(replyText);

  if (!clean) {
    return {
      decision: 'unclear',
      extraContent: '',
      hasExtraContent: false,
      isContentfulClarification: false,
    };
  }

  const decision = REJECT_PATTERNS.some((pattern) => pattern.test(clean))
    ? 'reject'
    : CONFIRM_PATTERNS.some((pattern) => pattern.test(clean))
      ? 'confirm'
      : 'unclear';

  const extraContent = extractExtraContent(replyText);

  return {
    decision,
    extraContent,
    hasExtraContent: Boolean(extraContent),
    isContentfulClarification: decision === 'unclear' && countWords(clean) >= 8,
  };
};

export const classifyTranscriptConfirmationReply = (replyText = '') => {
  return analyzeTranscriptConfirmationReply(replyText).decision;
};