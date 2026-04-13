export const normalize = (value = '') => String(value || '').trim().toLowerCase();
export const normalizeList = (items = []) => items.map((item) => normalize(item)).filter(Boolean);
export const includesNormalized = (items = [], keyword = '') => normalizeList(items).some((item) => item.includes(normalize(keyword)));
export const containsInText = (text = '', keyword = '') => normalize(text).includes(normalize(keyword));
export const toRangeCheck = (value, min, max) => Number(value) >= Number(min) && Number(value) <= Number(max);
export const unique = (items = []) => [...new Set(items.filter(Boolean))];

export const flattenExplanationItems = (items = []) =>
  items.flatMap((item) => [item.label, item.detail, ...(item.evidence || [])].filter(Boolean));

export const computeBucketScore = (checks = []) => {
  if (!checks.length) return 1;
  const passed = checks.filter((check) => check.passed).length;
  return Number((passed / checks.length).toFixed(2));
};

export const buildMarkdownTable = (rows = []) => {
  const header = '| case | score | failed checks |';
  const divider = '| --- | ---: | --- |';
  const body = rows.map((row) => `| ${row.id} | ${row.score} | ${(row.failedChecks || []).join(', ') || '-'} |`);
  return [header, divider, ...body].join('\n');
};
