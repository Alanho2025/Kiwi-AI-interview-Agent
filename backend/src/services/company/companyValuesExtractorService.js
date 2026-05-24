import { callDeepSeek } from '../deepseekService.js';

const VALUE_HEADING_PATTERN = /\b(values?|principles?|culture|mission|purpose|what we stand for|who we are)\b/i;
const BULLET_PATTERN = /^(?:[-*•]|\d+[.)])\s+/;

const extractJsonObject = (text = '') => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
};

const normalizeId = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

const normalizeExtractedValues = (value = {}) => ({
  mission: String(value.mission || '').trim(),
  values: Array.isArray(value.values)
    ? value.values
        .map((item) => ({
          id: normalizeId(item.id || item.label),
          label: String(item.label || '').trim(),
          description: String(item.description || '').trim(),
          sourceUrl: String(item.sourceUrl || '').trim(),
          confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 0.5,
        }))
        .filter((item) => item.id && item.label && item.description)
    : [],
  cultureNotes: Array.isArray(value.cultureNotes)
    ? value.cultureNotes.map((item) => String(item || '').trim()).filter(Boolean)
    : [],
  confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : 0,
});

const buildHeuristicCompanyValues = ({ pages = [] } = {}) => {
  const values = [];
  const cultureNotes = [];
  let mission = '';

  for (const page of pages) {
    const lines = String(page.text || '')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 8 && line.length <= 220);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const nearValueHeading = VALUE_HEADING_PATTERN.test(line)
        || lines.slice(Math.max(0, index - 2), index).some((previous) => VALUE_HEADING_PATTERN.test(previous));

      if (!mission && /\b(mission|purpose)\b/i.test(line)) {
        mission = line.replace(/^our\s+(mission|purpose)\s*(is|:)?\s*/i, '').trim();
      }

      if (nearValueHeading && (BULLET_PATTERN.test(line) || /^[A-Z][A-Za-z &-]{2,40}:/.test(line))) {
        const cleaned = line.replace(BULLET_PATTERN, '').trim();
        const [labelPart, ...descriptionParts] = cleaned.split(':');
        const label = labelPart.trim();
        const description = descriptionParts.join(':').trim() || cleaned;
        if (label && label.length <= 50 && !values.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
          values.push({
            id: normalizeId(label),
            label,
            description,
            sourceUrl: page.url,
            confidence: 0.55,
          });
        }
      }

      if (nearValueHeading && /culture|team|people|customer|community|innovation|integrity|collaboration|learning/i.test(line)) {
        cultureNotes.push(line);
      }
    }
  }

  return normalizeExtractedValues({
    mission,
    values: values.slice(0, 6),
    cultureNotes: [...new Set(cultureNotes)].slice(0, 5),
    confidence: values.length ? 0.58 : 0.25,
  });
};

export const extractCompanyValuesFromPages = async ({
  companyName,
  websiteUrl,
  pages = [],
} = {}) => {
  const usablePages = pages.filter((page) => page.text && page.text.length >= 300);
  if (!usablePages.length) {
    return { mission: '', values: [], cultureNotes: [], confidence: 0 };
  }

  if (process.env.COMPANY_VALUES_AI_ENABLED === 'false') {
    return buildHeuristicCompanyValues({ pages: usablePages });
  }

  const evidence = usablePages
    .map((page) => `SOURCE: ${page.url}\n${page.text.slice(0, 2500)}`)
    .join('\n\n---\n\n');

  const prompt = `
Extract company values, mission, and culture notes from the official website content.

Return valid JSON only.

Company: ${companyName}
Website: ${websiteUrl}

Required JSON shape:
{
  "mission": "string",
  "values": [
    {
      "id": "snake_case",
      "label": "string",
      "description": "string",
      "sourceUrl": "string",
      "confidence": 0.0
    }
  ],
  "cultureNotes": ["string"],
  "confidence": 0.0
}

Rules:
- Use only the provided website text.
- Do not invent values.
- Prefer explicit values, mission, purpose, culture, principles.
- If no reliable values are found, return values: [] and confidence below 0.4.
- sourceUrl must be one of the provided SOURCE URLs.

Website content:
${evidence}
`;

  try {
    const { content } = await callDeepSeek(
      prompt,
      'You output valid JSON only. Stay grounded in the provided website text.',
      {
        usageMetadata: {
          stage: 'report_generated',
          operation: 'llm_chat',
          feature: 'company_values_enrichment',
        },
      }
    );

    const parsed = JSON.parse(extractJsonObject(content));
    return normalizeExtractedValues(parsed);
  } catch {
    return buildHeuristicCompanyValues({ pages: usablePages });
  }
};
