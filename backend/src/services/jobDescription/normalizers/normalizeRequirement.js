
import { collectMappedPoints, fallbackPoint } from './bluepointShared.js';

const REQUIREMENT_MAPPINGS = [
  { label: 'SQL', patterns: [/\bsql\b/i] },
  { label: 'Snowflake', patterns: [/snowflake/i] },
  { label: 'dbt', patterns: [/\bdbt\b/i] },
  { label: 'Data Modelling', patterns: [/data modelling/i, /dimensional modelling/i, /dv2/i] },
  { label: 'Semantic Layers', patterns: [/semantic layers?/i] },
  { label: 'ADF', patterns: [/\badf\b/i, /data orchestration/i] },
  { label: 'Python', patterns: [/\bpython\b/i] },
  { label: 'Excel', patterns: [/\bexcel\b/i] },
  { label: 'Power BI', patterns: [/power\s?bi/i] },
  { label: 'React', patterns: [/\breact\b/i] },
  { label: 'TypeScript', patterns: [/typescript|\bts\b/i] },
  { label: 'JavaScript', patterns: [/javascript|\bjs\b/i] },
  { label: 'C#', patterns: [/c#/i] },
  { label: '.NET', patterns: [/\.net/i] },
  { label: 'REST API Experience', patterns: [/restful api/i, /rest api/i] },
  { label: 'API Integration', patterns: [/integrations?/i, /api/i] },
  { label: 'AWS', patterns: [/\baws\b/i] },
  { label: 'Azure', patterns: [/\bazure\b/i] },
  { label: 'Docker', patterns: [/docker/i] },
  { label: 'GitHub Actions', patterns: [/github actions/i] },
  { label: 'Storybook', patterns: [/storybook/i] },
  { label: 'ArcGIS', patterns: [/arcgis|esri/i] },
  { label: 'Jupyter', patterns: [/jupyter/i] },
  { label: 'PyTorch', patterns: [/pytorch/i] },
  { label: 'Keras', patterns: [/keras/i] },
  { label: '3+ Years Experience', patterns: [/at least 3 years|3\+ years/i] },
  { label: '5+ Years Experience', patterns: [/5\+ years/i] },
  { label: '7+ Years Experience', patterns: [/7\+ years/i] },
  { label: "Bachelor's Degree", patterns: [/bachelor'?s degree|bsc\/ba|tertiary qualification/i] },
  { label: 'Communication Skills', patterns: [/communication/i, /explain findings/i] },
  { label: 'Stakeholder Collaboration', patterns: [/stakeholders?/i, /non-technical/i] },
  { label: 'Problem Solving', patterns: [/problem.solv/i, /detective work/i] },
  { label: 'Adaptability', patterns: [/adaptable|switching gears/i] },
  { label: 'Portfolio', patterns: [/portfolio/i] },
  { label: 'UX/UI Contribution', patterns: [/ux\/ui/i, /eye for design/i, /design/i] },
  { label: 'Geospatial Analytics', patterns: [/geospatial/i, /mapping applications?/i] },
  { label: 'Statistical Methods', patterns: [/statistical/i, /mathematical/i] },
  { label: 'AI API Integration', patterns: [/openai|azure openai|ai apis?/i] },
  { label: 'Workflow Automation', patterns: [/automation/i, /workflows?/i] },
  { label: 'Ambiguity Handling', patterns: [/ambiguity/i] },
  { label: 'Deadline Delivery', patterns: [/under deadlines|on time|deliver projects on time/i] },
  { label: 'Production Experience', patterns: [/production environments?|production data workflows?/i] },
  { label: 'Commercial Mindset', patterns: [/commercial mindset/i, /drive revenue/i, /gtm/i] },
  { label: 'NZ Work Rights', patterns: [/right to work in new zealand|work rights|citizenship|permanent residency/i] },
  { label: 'Medical Screening', patterns: [/medical check|drug screening/i] },
];

export const normalizeRequirementPoints = (item, evidenceMap = {}) => {
  const text = typeof item === 'string' ? item : item?.label || item?.text || '';
  const mapped = collectMappedPoints(text, REQUIREMENT_MAPPINGS, evidenceMap);
  if (mapped.length > 0) return mapped;
  const fallback = fallbackPoint(text, 6);
  if (fallback) {
    evidenceMap[fallback] = [...new Set([...(evidenceMap[fallback] || []), text])];
    return [fallback];
  }
  return [];
};
