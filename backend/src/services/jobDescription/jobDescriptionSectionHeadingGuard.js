const HEADING_LABELS = new Set([
  'about the hiring team',
  'about the team',
  'about the role',
  'about us',
  'about you',
  'benefits',
  'bonus',
  'bonus requirements',
  'business unit',
  'company overview',
  'core requirements',
  'duties',
  'experience and skills',
  'experience level',
  'hiring team',
  'how to apply',
  'job overview',
  'key deliverables',
  'key relationships',
  'key responsibilities',
  'level',
  'nice to have',
  'nice to haves',
  'pluses',
  'preferred',
  'preferred experience',
  'preferred qualifications',
  'primary responsibilities',
  'qualifications',
  'requirements',
  'responsibilities',
  'role entails',
  'roles and responsibilities',
  'selection criteria',
  'seniority',
  'skills and experience',
  'stack',
  'tech stack',
  'technologies',
  'technology stack',
  'the role',
  'the tech stack',
  'tools',
  'what the role entails',
  'what we are looking for',
  "what we're looking for",
  'what we offer',
  'what you bring',
  "what you'll bring",
  "what you'll do",
  'what you will do',
  "what's in it for you",
  'who you are',
  "who we're looking for",
  'why img',
  'why join us',
  'why us',
  'why work for us',
  'you will',
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
  if (!normalized) return false;
  if (HEADING_LABELS.has(normalized)) return true;
  return /^about .{1,60}$/.test(normalized) && !/\b(experience|qualification|python|javascript|sql|aws|react|node|customer|project|workflow)\b/i.test(normalized);
};

export const filterJobDescriptionSectionHeadings = (items = [], getText = (item) => item) => (
  items.filter((item) => !isJobDescriptionSectionHeading(getText(item)))
);
