const MONTH_PATTERN = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)';

const splitBulletLines = (text = '') => String(text || '')
  .split('\n')
  .map((line) => line.replace(/^[-•*]\s*/, '').trim())
  .filter(Boolean)
  .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line));

const PROJECT_TECH_TERMS = [
  'react',
  'node.js',
  'node',
  'express',
  'postgresql',
  'postgres',
  'sql',
  'aws',
  'azure',
  'azure speech',
  'gcp',
  'python',
  'java',
  'javascript',
  'typescript',
  'html',
  'css',
  'tailwind css',
  'tailwind',
  'mongodb',
  'api',
  'llm api',
  'deepseek api',
  'deepseek',
  'openai',
  'websocket',
  'docker',
  'kubernetes',
  'git',
  'trello',
  'continuous integration',
  'ci',
  'vite',
  'vitest',
  'playwright',
  'vercel',
  'render',
  'fastapi',
  'langchain',
  'spss',
  'unity',
  'c++',
  'c',
  'photoshop',
  'sketch',
  'indesign',
  'jquery',
  'google maps api',
  '3d modelling',
  '3d modeling',
  'animation',
];

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildTechPattern = (term = '') => {
  const escaped = escapeRegex(term);
  return new RegExp(`(^|[^a-z0-9+#])${escaped}(?![a-z0-9+#])`, 'i');
};

const inferTechStack = (text = '') => {
  const lower = String(text || '').toLowerCase();
  return PROJECT_TECH_TERMS.filter((item) => buildTechPattern(item).test(lower));
};

const isDateStartLine = (line = '') => new RegExp(`^${MONTH_PATTERN}\\s+\\d{4}\\s*(?:[-–]\\s*(?:${MONTH_PATTERN})?\\s*(?:\\d{4}|present|current)?)?$`, 'i')
  .test(String(line || '').trim());

const isDateContinuationLine = (line = '') => /^(?:present|current|\d{4})$/i.test(String(line || '').trim());

const isDateOnlyLine = (line = '') => isDateStartLine(line) || isDateContinuationLine(line);

const isTechLine = (line = '') => /^tech(?:nologies)?\s*:/i.test(String(line || '').trim());

const isTitleContinuationLine = (previousLine = '', line = '') => {
  const trimmed = String(line || '').trim();
  return /[-–]$/.test(previousLine) || /^[a-z0-9.-]+\/?$/i.test(trimmed);
};

const titleStartIndex = (lines = []) => lines.findIndex((line) => !isDateOnlyLine(line));

const titleEndIndex = (lines = [], startIndex = -1) => {
  if (startIndex < 0) return -1;

  let endIndex = startIndex;
  while (endIndex + 1 < lines.length) {
    const currentLine = lines[endIndex];
    const nextLine = lines[endIndex + 1];
    if (!isTitleContinuationLine(currentLine, nextLine)) break;
    endIndex += 1;
  }
  return endIndex;
};

const buildProjectBlocksFromDatedLines = (lines = []) => {
  const blocks = [];
  let currentLines = [];

  for (const line of lines) {
    const startsNextProject = isDateStartLine(line) && currentLines.some((item) => !isDateOnlyLine(item));
    if (startsNextProject) {
      blocks.push(currentLines.join('\n'));
      currentLines = [];
    }
    currentLines.push(line);
  }

  if (currentLines.length) blocks.push(currentLines.join('\n'));
  return blocks;
};

const splitProjectBlocks = (text = '') => {
  const lines = splitBulletLines(text);
  if (!lines.length) return [];

  if (lines.some(isDateStartLine)) {
    return buildProjectBlocksFromDatedLines(lines);
  }

  return String(text || '').trim()
    .split(/\n(?=\d{4}\s*-|[A-Z][^\n]{0,80}(?:Project|Analysis|Hub|App|Platform|Agent|Assistant|Engine|Engineered|System|Prototype|Dashboard|Matcher))/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeProjectBlock = (block = '') => {
  const lines = splitBulletLines(block);
  const startIndex = titleStartIndex(lines);
  const endIndex = titleEndIndex(lines, startIndex);
  const title = startIndex >= 0 ? lines.slice(startIndex, endIndex + 1).join(' ') : '';
  const rest = lines
    .filter((_, index) => index < startIndex || index > endIndex)
    .filter((line) => !isDateOnlyLine(line))
    .filter((line) => !isTechLine(line));
  const responsibilities = rest.filter((line) => !/\b(reduced|improved|lowered|increased|deployed|migrated|built)\b/i.test(line));
  const outcomes = rest.filter((line) => /\b(reduced|improved|lowered|increased|deployed|migrated|built)\b/i.test(line));
  return {
    title,
    context: lines.slice(0, 2).join(' '),
    techStack: inferTechStack(block),
    responsibilities,
    outcomes,
    rawText: block,
  };
};

export const normalizeProjectsSection = (text = '') => {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const blocks = splitProjectBlocks(raw);
  return blocks.map(normalizeProjectBlock);
};
