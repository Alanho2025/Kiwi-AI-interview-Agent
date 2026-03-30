const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or',
  'that', 'the', 'to', 'with', 'will', 'you', 'your', 'our', 'we', 'they', 'this', 'these', 'those',
  'have', 'has', 'had', 'their', 'them', 'can', 'may', 'should', 'must', 'not', 'than', 'into', 'about',
  'role', 'job', 'experience', 'skills', 'skill', 'requirements', 'required', 'preferred', 'looking',
  'candidate', 'ability', 'using', 'used', 'strong', 'including', 'across', 'within', 'such'
]);

const SKILL_PATTERNS = [
  ['javascript', /\bjavascript\b/i],
  ['typescript', /\btypescript\b/i],
  ['node.js', /\bnode(?:\.js)?\b/i],
  ['react', /\breact\b/i],
  ['vue', /\bvue\b/i],
  ['angular', /\bangular\b/i],
  ['next.js', /\bnext(?:\.js)?\b/i],
  ['html', /\bhtml\b/i],
  ['css', /\bcss\b/i],
  ['tailwind', /\btailwind\b/i],
  ['python', /\bpython\b/i],
  ['java', /\bjava\b/i],
  ['c#', /\bc#\b|\bcsharp\b/i],
  ['php', /\bphp\b/i],
  ['go', /\bgolang\b|\bgo\b/i],
  ['sql', /\bsql\b/i],
  ['postgresql', /\bpostgres(?:ql)?\b/i],
  ['mysql', /\bmysql\b/i],
  ['mongodb', /\bmongodb\b|\bmongo\b/i],
  ['redis', /\bredis\b/i],
  ['aws', /\baws\b|\bamazon web services\b/i],
  ['azure', /\bazure\b/i],
  ['gcp', /\bgcp\b|\bgoogle cloud\b/i],
  ['docker', /\bdocker\b/i],
  ['kubernetes', /\bkubernetes\b|\bk8s\b/i],
  ['git', /\bgit\b/i],
  ['ci/cd', /\bci\/cd\b|\bcontinuous integration\b|\bcontinuous delivery\b/i],
  ['testing', /\btesting\b|\bjest\b|\bcypress\b|\bplaywright\b|\bunit test/i],
  ['rest api', /\brest\b|\brestful\b|\bapi\b/i],
  ['graphql', /\bgraphql\b/i],
  ['agile', /\bagile\b|\bscrum\b|\bkanban\b/i],
  ['communication', /\bcommunication\b|\bstakeholder\b|\bcollaboration\b/i],
  ['leadership', /\bleadership\b|\bmentor\b|\bmentoring\b|\blead\b/i],
];

const SENIORITY_PATTERNS = [
  ['junior', /\bjunior\b|\bgraduate\b|\bgrad\b|\bentry[- ]level\b/i],
  ['mid', /\bintermediate\b|\bmid(?:[- ]level)?\b/i],
  ['senior', /\bsenior\b|\blead\b|\bprincipal\b|\bstaff\b/i],
];

const normalizeText = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/\r/g, '\n')
    .replace(/[^a-z0-9+#.\n/ -]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const tokenize = (text) =>
  normalizeText(text)
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

const unique = (items) => [...new Set(items)];

const extractSkills = (text) =>
  SKILL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([skill]) => skill);

const extractSeniority = (text) => {
  const found = SENIORITY_PATTERNS.find(([, pattern]) => pattern.test(text));
  return found?.[0] || '';
};

const extractCandidateName = (cvText) => {
  const firstLine = (cvText || '').split('\n').map((line) => line.trim()).find(Boolean) || '';
  if (/^[A-Za-z][A-Za-z' -]{1,60}$/.test(firstLine) && firstLine.split(/\s+/).length <= 4) {
    return firstLine;
  }
  return 'Candidate';
};

const extractJobTitle = (jdText) => {
  const explicitMatch = jdText.match(/1\.\s*Job Title:\s*(.+)/i);
  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim();
  }

  const lines = jdText.split('\n').map((line) => line.trim()).filter(Boolean);
  const titleLine = lines.find((line) => /engineer|developer|manager|designer|analyst|architect|consultant/i.test(line));
  return titleLine || 'Target Role';
};

const extractKeywordPhrases = (jdText) => {
  const phrases = [];
  const normalized = normalizeText(jdText);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    if (!/must|required|responsib|qualif|need|experience|skill|knowledge|familiar|profic/i.test(line)) {
      continue;
    }

    const content = line.includes(':') ? line.split(':').slice(1).join(':') : line;
    const candidates = content
      .split(/[,;•]|(?:\band\b)|(?:\bor\b)/)
      .map((part) => part.trim())
      .filter((part) => {
        const words = part.split(/\s+/).filter(Boolean);
        return words.length >= 2 && words.length <= 6 && part.length <= 50;
      });

    phrases.push(...candidates);
  }

  return unique(phrases).slice(0, 20);
};

const buildKeywordUniverse = (jdText) => {
  const tokens = tokenize(jdText);
  const frequencies = new Map();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  return [...frequencies.entries()]
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 30)
    .map(([token]) => token);
};

const calculateCoverage = (requiredItems, cvText) => {
  if (requiredItems.length === 0) {
    return { matched: [], missing: [], ratio: 0 };
  }

  const normalizedCv = normalizeText(cvText);
  const matched = [];
  const missing = [];

  for (const item of requiredItems) {
    const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(normalizedCv)) {
      matched.push(item);
    } else {
      missing.push(item);
    }
  }

  return {
    matched,
    missing,
    ratio: matched.length / requiredItems.length,
  };
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

export const compareCvToJobDescription = (cvText, jdText, settings = {}) => {
  const normalizedCv = normalizeText(cvText);
  const normalizedJd = normalizeText(jdText);

  const jdSkills = extractSkills(normalizedJd);
  const skillCoverage = calculateCoverage(jdSkills, normalizedCv);

  const jdKeywords = buildKeywordUniverse(normalizedJd);
  const keywordCoverage = calculateCoverage(jdKeywords, normalizedCv);

  const jdPhrases = extractKeywordPhrases(jdText);
  const phraseCoverage = calculateCoverage(jdPhrases, normalizedCv);

  const jdSeniority = extractSeniority(normalizedJd);
  const cvSeniority = extractSeniority(normalizedCv);
  const seniorityAligned = !jdSeniority || !cvSeniority || jdSeniority === cvSeniority;

  const score =
    (skillCoverage.ratio * 45) +
    (keywordCoverage.ratio * 35) +
    (phraseCoverage.ratio * 15) +
    (seniorityAligned ? 5 : 0);

  const strengths = unique([
    ...skillCoverage.matched.slice(0, 4).map((item) => `Evidence of ${item}`),
    ...phraseCoverage.matched.slice(0, 2).map((item) => `Matches JD requirement: ${item}`),
  ]).slice(0, 5);

  const gaps = unique([
    ...skillCoverage.missing.slice(0, 4),
    ...phraseCoverage.missing.slice(0, 3),
  ]).slice(0, 5);

  const interviewFocus = unique([
    ...gaps.slice(0, 3),
    ...(settings.enableNZCultureFit ? ['communication', 'teamwork'] : []),
  ]).slice(0, 4);

  return {
    candidateName: extractCandidateName(cvText),
    jobTitle: extractJobTitle(jdText),
    matchScore: clampScore(score),
    strengths: strengths.length > 0 ? strengths : ['General alignment with the job description'],
    gaps: gaps.length > 0 ? gaps : ['No major coverage gaps detected from the parsed JD'],
    interviewFocus: interviewFocus.length > 0 ? interviewFocus : ['role-specific problem solving'],
    planPreview: `Interview emphasis: ${interviewFocus.length > 0 ? interviewFocus.join(', ') : 'role-specific problem solving'}.`,
    matchingDetails: {
      matchedSkills: skillCoverage.matched,
      missingSkills: skillCoverage.missing,
      matchedKeywords: keywordCoverage.matched,
      missingKeywords: keywordCoverage.missing,
      matchedPhrases: phraseCoverage.matched,
      missingPhrases: phraseCoverage.missing,
      jdSeniority,
      cvSeniority,
      seniorityAligned,
    },
  };
};
