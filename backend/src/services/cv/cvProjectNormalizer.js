const splitBulletLines = (text = '') => String(text || '')
  .split('\n')
  .map((line) => line.replace(/^[-•*]\s*/, '').trim())
  .filter(Boolean);

const inferTechStack = (text = '') => {
  const lower = String(text || '').toLowerCase();
  const known = ['react', 'node.js', 'node', 'postgresql', 'sql', 'aws', 'python', 'spss', 'mongodb', 'api', 'html', 'css', 'javascript'];
  return known.filter((item) => lower.includes(item));
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
  const blocks = raw.split(/\n(?=\d{4}\s*-|[A-Z][^\n]{0,80}(?:Project|Analysis|Hub|App|Platform))/).map((item) => item.trim()).filter(Boolean);
  return blocks.map(normalizeProjectBlock);
};
