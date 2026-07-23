const HEADING_LABELS = new Set([
  'about the role',
  'about us',
  'about you',
  'benefits',
  'bonus requirements',
  'core requirements',
  'experience and skills',
  'experience level',
  'job overview',
  'key responsibilities',
  'nice to have',
  'preferred experience',
  'preferred qualifications',
  'qualifications',
  'requirements',
  'responsibilities',
  'roles and responsibilities',
  'selection criteria',
  'seniority',
  'skills and experience',
  'tech stack',
  'tools',
  'what we are looking for',
  "what we're looking for",
  'what you bring',
  "what you'll bring",
  "what you'll do",
  'what you will do',
  'who you are',
  "who we're looking for",
]);

export const normalizeJobDescriptionHeadingCandidate = (value = '') => String(value || '')
  .replace(/^[\s•\-*]+/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[.:：;]+$/g, '')
  .replace(/\s*&\s*/g, ' and ')
  .replace(/\s+/g, ' ')
  .toLowerCase();

export const isJobDescriptionSectionHeading = (value = '') => {
  const normalized = normalizeJobDescriptionHeadingCandidate(value);
  return Boolean(normalized && HEADING_LABELS.has(normalized));
};
