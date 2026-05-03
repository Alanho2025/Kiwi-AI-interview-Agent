import { tokenizeJobDescriptionHeaderLines } from './jobDescriptionHeaderTokenizer.js';
import { extractJobTitle } from './extractors/titleExtractor.js';
import { extractCompanyName } from './extractors/companyExtractor.js';
import { extractLocation } from './extractors/locationExtractor.js';
import { extractEmploymentType } from './extractors/employmentTypeExtractor.js';

const cleanHeaderLine = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const SALARY_PATTERN = /(\$|salary|hourly rate|per year|competitive|expected salary)/i;
const CONTRACT_PATTERN = /(\d+\s*(?:month|year)\s*contract|fixed term)/i;

export const extractJobDescriptionHeader = ({ rawJD = '', fallbackTitle = '', normalized = null }) => {
  const normalizedSource = normalized || { lines: String(rawJD || '').split(/\r?\n/).map(cleanHeaderLine).filter(Boolean), flatText: String(rawJD || '').replace(/\s+/g, ' ') };
  const tokenizedLines = tokenizeJobDescriptionHeaderLines(normalizedSource.lines || []);
  const titleResult = extractJobTitle({ lines: tokenizedLines });
  const title = titleResult.value && titleResult.value !== 'Target Role' ? titleResult.value : fallbackTitle;
  const normalizeKey = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const titleKeys = new Set([normalizeKey(title), ...(titleResult.candidates || []).map((item) => normalizeKey(item.value))].filter(Boolean));
  const afterTitleIndex = tokenizedLines.findIndex((line) => {
    const key = normalizeKey(line);
    if (titleKeys.has(key)) return true;
    return [...titleKeys].some((titleKey) => titleKey && key.startsWith(titleKey));
  });
  const afterTitleLines = afterTitleIndex >= 0 ? tokenizedLines.slice(afterTitleIndex + 1) : tokenizedLines;

  const company = extractCompanyName({ afterTitleLines, title, allLines: normalizedSource.lines || [] });
  const location = extractLocation({ afterTitleLines });
  const employmentType = extractEmploymentType({ afterTitleLines, flatText: normalizedSource.flatText });
  const salaryText = afterTitleLines.find((line) => /^salary:/i.test(line))?.replace(/^salary:\s*/i, '').trim()
    || afterTitleLines.find((line) => SALARY_PATTERN.test(line))
    || '';
  const contractType = [title, ...afterTitleLines].find((line) => CONTRACT_PATTERN.test(line)) || '';

  return {
    title,
    companyName: company.value,
    location: location.value,
    employmentType: employmentType.value,
    salaryText,
    contractType,
    source: 'header_tokenizer_v1',
    candidates: {
      title: titleResult.candidates,
      companyName: company.candidates,
      location: location.candidates,
      employmentType: employmentType.candidates,
    },
    fieldConfidence: {
      title: titleResult.confidence,
      companyName: company.confidence,
      location: location.confidence,
      employmentType: employmentType.confidence,
    },
  };
};
