const ACHIEVEMENT_PATTERNS = [
  { type: 'quantified_impact', regex: /\b(?:reduced|lowered|improved|increased|decreased|saved|cut)\b[^\n]{0,160}\b\d+(?:\.\d+)?%?\b[^\n]{0,80}/gi },
  { type: 'delivery_outcome', regex: /\b(?:deployed|migrated|built)\b[^\n]{0,160}/gi },
  { type: 'efficiency_gain', regex: /\b(?:saved|reducing manual effort|improving analysis speed)\b[^\n]{0,120}/gi },
];

export const extractAchievements = (text = '') => {
  const source = String(text || '');
  const results = [];
  for (const pattern of ACHIEVEMENT_PATTERNS) {
    const matches = source.match(pattern.regex) || [];
    for (const match of matches) {
      results.push({
        text: match.trim(),
        type: pattern.type,
        category: /%/.test(match) ? 'quantified' : 'delivery',
        magnitude: (match.match(/\d+%?/g) || []).join(' to '),
      });
    }
  }
  return results;
};
