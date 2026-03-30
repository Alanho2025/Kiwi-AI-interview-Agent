import { buildStructuredJobDescriptionRubric } from './jobDescriptionService.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or',
  'that', 'the', 'to', 'with', 'will', 'you', 'your', 'our', 'we', 'they', 'this', 'these', 'those',
  'have', 'has', 'had', 'their', 'them', 'can', 'may', 'should', 'must', 'not', 'than', 'into', 'about',
  'role', 'job', 'experience', 'skills', 'skill', 'requirements', 'required', 'preferred', 'looking',
  'candidate', 'ability', 'using', 'used', 'strong', 'including', 'across', 'within', 'such'
]);

const TOKEN_ALIASES = new Map([
  ['bachelors', 'bachelor'],
  ['bachelor', 'bachelor'],
  ['masters', 'master'],
  ['master', 'master'],
  ['phd', 'doctorate'],
  ['doctorate', 'doctorate'],
  ['certification', 'certificate'],
  ['certified', 'certificate'],
  ['certificates', 'certificate'],
  ['qualification', 'qualified'],
  ['qualifications', 'qualified'],
  ['qualified', 'qualified'],
  ['equivalent', 'equivalent'],
  ['analyst', 'analyst'],
  ['analysis', 'analyst'],
  ['analytics', 'analyst'],
  ['analyze', 'analyst'],
  ['analysing', 'analyst'],
  ['dashboard', 'dashboard'],
  ['dashboards', 'dashboard'],
  ['reporting', 'report'],
  ['reports', 'report'],
  ['report', 'report'],
  ['communication', 'communication'],
  ['communicate', 'communication'],
  ['communicating', 'communication'],
  ['stakeholders', 'stakeholder'],
  ['stakeholder', 'stakeholder'],
  ['team', 'teamwork'],
  ['teams', 'teamwork'],
  ['teamwork', 'teamwork'],
  ['collaborate', 'collaboration'],
  ['collaboration', 'collaboration'],
  ['collaborative', 'collaboration'],
  ['owned', 'ownership'],
  ['owning', 'ownership'],
  ['ownership', 'ownership'],
  ['internship', 'intern'],
  ['intern', 'intern'],
]);

const QUALIFICATION_SIGNALS = new Set([
  'bachelor',
  'master',
  'doctorate',
  'diploma',
  'certificate',
  'qualified',
  'equivalent',
  'degree',
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

const normalizeToken = (token) => {
  const normalized = (token || '').toLowerCase().trim();
  if (!normalized) {
    return '';
  }

  if (TOKEN_ALIASES.has(normalized)) {
    return TOKEN_ALIASES.get(normalized);
  }

  if (normalized.endsWith('ies') && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (normalized.endsWith('ing') && normalized.length > 5) {
    return normalized.slice(0, -3);
  }

  if (normalized.endsWith('ed') && normalized.length > 4) {
    return normalized.slice(0, -2);
  }

  if (normalized.endsWith('s') && normalized.length > 4) {
    return normalized.slice(0, -1);
  }

  return normalized;
};

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
    .map(normalizeToken)
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

const calculateLooseCoverage = (requiredItems, cvText, minimumTokenRatio = 0.5) => {
  if (requiredItems.length === 0) {
    return { matched: [], missing: [], ratio: 0 };
  }

  const cvTokens = new Set(tokenize(cvText));
  const matched = [];
  const missing = [];

  for (const item of requiredItems) {
    const itemTokens = unique(tokenize(item));
    if (itemTokens.length === 0) {
      missing.push(item);
      continue;
    }

    const overlap = itemTokens.filter((token) => cvTokens.has(token));
    const ratio = overlap.length / itemTokens.length;
    const hasQualificationSignal = itemTokens.some((token) => QUALIFICATION_SIGNALS.has(token));
    const shortItemMatch = itemTokens.length <= 2 && overlap.length >= 1;
    const mediumItemMatch = itemTokens.length <= 4 && overlap.length >= 2;
    const qualificationSignalMatch = hasQualificationSignal && overlap.length >= 1;

    if (ratio >= minimumTokenRatio || shortItemMatch || mediumItemMatch || qualificationSignalMatch) {
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

const normalizeRubric = (rawJD, jdRubric) => {
  if (jdRubric) {
    return {
      title: jdRubric.title || 'Target Role',
      roleSummary: jdRubric.roleSummary || [],
      qualifications: jdRubric.qualifications || [],
      neededSkills: jdRubric.neededSkills || [],
      softSkillRequirements: jdRubric.softSkillRequirements || [],
      technicalSkillRequirements: jdRubric.technicalSkillRequirements || [],
      mustHaveRequirements: jdRubric.mustHaveRequirements || [],
      niceToHaveExperience: jdRubric.niceToHaveExperience || [],
      keywords: jdRubric.keywords || [],
    };
  }

  return buildStructuredJobDescriptionRubric(rawJD || '');
};

export const compareCvToJobDescription = (cvText, rawJD, jdRubric, settings = {}) => {
  const normalizedCv = normalizeText(cvText);
  const rubric = normalizeRubric(rawJD, jdRubric);
  const normalizedRubricText = normalizeText([
    rubric.title,
    ...rubric.roleSummary,
    ...rubric.qualifications,
    ...rubric.neededSkills,
    ...rubric.mustHaveRequirements,
    ...rubric.niceToHaveExperience,
    ...rubric.keywords,
  ].join('\n'));

  const softSkillItems = unique((rubric.softSkillRequirements || []).map((item) => item.toLowerCase()));
  const softSkillCoverage = calculateCoverage(softSkillItems, normalizedCv);

  const technicalSkillItems = unique((rubric.technicalSkillRequirements || []).map((item) => item.toLowerCase()));
  const technicalSkillCoverage = calculateCoverage(technicalSkillItems, normalizedCv);

  const qualificationItems = unique((rubric.qualifications || []).map((item) => item.toLowerCase()));
  const qualificationCoverage = calculateLooseCoverage(qualificationItems, normalizedCv, 0.4);

  const roleItems = unique([
    rubric.title?.toLowerCase(),
    ...(rubric.roleSummary || []).map((item) => item.toLowerCase()),
  ]);
  const roleCoverage = calculateLooseCoverage(roleItems, normalizedCv, 0.34);

  const jdSeniority = extractSeniority(normalizedRubricText);
  const cvSeniority = extractSeniority(normalizedCv);
  const seniorityAligned = !jdSeniority || !cvSeniority || jdSeniority === cvSeniority;

  const weightedBreakdown = {
    softSkills: {
      label: 'Soft Skill Requirement',
      weight: 45,
      rawRatio: softSkillCoverage.ratio,
      score: clampScore(softSkillCoverage.ratio * 45),
      matchedCount: softSkillCoverage.matched.length,
      totalCount: softSkillCoverage.matched.length + softSkillCoverage.missing.length,
    },
    technicalSkills: {
      label: 'Technical Skill Requirement',
      weight: 35,
      rawRatio: technicalSkillCoverage.ratio,
      score: clampScore(technicalSkillCoverage.ratio * 35),
      matchedCount: technicalSkillCoverage.matched.length,
      totalCount: technicalSkillCoverage.matched.length + technicalSkillCoverage.missing.length,
    },
    qualificationMatch: {
      label: 'Qualification Match',
      weight: 15,
      rawRatio: qualificationCoverage.ratio,
      score: clampScore(qualificationCoverage.ratio * 15),
      matchedCount: qualificationCoverage.matched.length,
      totalCount: qualificationCoverage.matched.length + qualificationCoverage.missing.length,
    },
    rolesMatch: {
      label: 'Roles Match',
      weight: 5,
      rawRatio: roleCoverage.ratio,
      score: clampScore(roleCoverage.ratio * 5),
      matchedCount: roleCoverage.matched.length,
      totalCount: roleCoverage.matched.length + roleCoverage.missing.length,
    },
  };

  const score =
    weightedBreakdown.softSkills.score +
    weightedBreakdown.technicalSkills.score +
    weightedBreakdown.qualificationMatch.score +
    weightedBreakdown.rolesMatch.score;

  const strengths = unique([
    ...technicalSkillCoverage.matched.slice(0, 3).map((item) => `Technical evidence: ${item}`),
    ...softSkillCoverage.matched.slice(0, 2).map((item) => `Soft skill evidence: ${item}`),
    ...qualificationCoverage.matched.slice(0, 2).map((item) => `Qualification evidence: ${item}`),
  ]).slice(0, 5);

  const gaps = unique([
    ...technicalSkillCoverage.missing.slice(0, 3),
    ...softSkillCoverage.missing.slice(0, 2),
    ...qualificationCoverage.missing.slice(0, 2),
    ...roleCoverage.missing.slice(0, 1),
  ]).slice(0, 5);

  const interviewFocus = unique([
    ...gaps.slice(0, 3),
    ...(settings.enableNZCultureFit ? ['communication', 'teamwork'] : []),
  ]).slice(0, 4);

  return {
    candidateName: extractCandidateName(cvText),
    jobTitle: rubric.title || extractJobTitle(rawJD || ''),
    matchScore: clampScore(score),
    strengths: strengths.length > 0 ? strengths : ['General alignment with the job description'],
    gaps: gaps.length > 0 ? gaps : ['No major coverage gaps detected from the parsed JD'],
    interviewFocus: interviewFocus.length > 0 ? interviewFocus : ['role-specific problem solving'],
    planPreview: `Interview emphasis: ${interviewFocus.length > 0 ? interviewFocus.join(', ') : 'role-specific problem solving'}.`,
    matchingDetails: {
      weightedBreakdown,
      matchedSoftSkills: softSkillCoverage.matched,
      missingSoftSkills: softSkillCoverage.missing,
      matchedTechnicalSkills: technicalSkillCoverage.matched,
      missingTechnicalSkills: technicalSkillCoverage.missing,
      matchedQualifications: qualificationCoverage.matched,
      missingQualifications: qualificationCoverage.missing,
      matchedRoleSignals: roleCoverage.matched,
      missingRoleSignals: roleCoverage.missing,
      jdSeniority,
      cvSeniority,
      seniorityAligned,
      rubric,
    },
  };
};
