/**
 * File responsibility: Classify short spoken replies to transcript confirmation prompts.
 * Keep this deterministic for latency and reliability in the duplex voice loop.
 */

const normalizeText = (value = '') => String(value || '').trim().toLowerCase().replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ');

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
  /\bclarify\b/,
  /\bthat's not\b/,
  /\bthat is not\b/,
];

export const classifyTranscriptConfirmationReply = (replyText = '') => {
  const clean = normalizeText(replyText);
  if (!clean) return 'unclear';

  if (REJECT_PATTERNS.some((pattern) => pattern.test(clean))) {
    return 'reject';
  }

  if (CONFIRM_PATTERNS.some((pattern) => pattern.test(clean))) {
    return 'confirm';
  }

  return 'unclear';
};
