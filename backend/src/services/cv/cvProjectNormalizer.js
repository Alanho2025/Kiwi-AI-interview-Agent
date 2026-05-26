const splitBulletLines = (text = '') => String(text || '')
  .split('\n')
  .map((line) => line.replace(/^[-•*]\s*/, '').trim())
  .filter(Boolean);

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

const inferTechStack = (text = '') => {
  const lower = String(text || '').toLowerCase();
  return PROJECT_TECH_TERMS.filter((item) => lower.includes(item));
};

export const normalizeProjectBlock = (block = '') => {
  const lines = splitBulletLines(block);
  const [title = '', ...rest] = lines;
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
  const blocks = raw.split(/\n(?=\d{4}\s*-|[A-Z][^\n]{0,80}(?:Project|Analysis|Hub|App|Platform|Agent|Assistant|Engine|Engineered|System|Prototype|Dashboard|Matcher))/).map((item) => item.trim()).filter(Boolean);
  return blocks.map(normalizeProjectBlock);
};