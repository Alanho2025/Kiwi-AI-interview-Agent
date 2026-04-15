
import { collectMappedPoints, fallbackPoint } from './bluepointShared.js';

const RESPONSIBILITY_MAPPINGS = [
  { label: 'Data Pipelines', patterns: [/data pipelines?/i, /etl/i, /elt/i] },
  { label: 'Semantic Layers', patterns: [/semantic layers?/i, /semantic models?/i] },
  { label: 'Reporting Datasets', patterns: [/curated datasets?/i, /reporting/i] },
  { label: 'Regulated Delivery', patterns: [/regulated environment/i, /compliance/i] },
  { label: 'Requirements Gathering', patterns: [/requirements/i, /scope projects?/i, /scope/i] },
  { label: 'Solution Design', patterns: [/design/i, /architecture/i] },
  { label: 'Deployment Handover', patterns: [/deployment/i, /handover/i, /release/i] },
  { label: 'Client Collaboration', patterns: [/clients?/i, /customer/i, /stakeholders?/i] },
  { label: 'Front-end Development', patterns: [/front-?end/i, /user-facing/i, /responsive/i, /web interfaces?/i] },
  { label: 'Back-end Development', patterns: [/back-?end/i, /server/i] },
  { label: 'API Development', patterns: [/restful api/i, /rest api/i, /apis?/i, /integrating apis?/i] },
  { label: 'Workflow Automation', patterns: [/automation/i, /automate/i, /workflows?/i] },
  { label: 'AI Feature Delivery', patterns: [/ai/i, /predictive insights?/i, /agentic/i] },
  { label: 'Code Quality', patterns: [/code review/i, /high-quality code/i, /testing/i, /reliability/i, /performance/i] },
  { label: 'Technical Mentoring', patterns: [/mentor/i, /guide fellow developers/i, /pair programming/i] },
  { label: 'Data Analysis', patterns: [/analy[sz]e datasets?/i, /statistical/i, /trends and patterns/i] },
  { label: 'Dashboard Delivery', patterns: [/dashboards?/i, /visuali[sz]ations?/i, /reports?/i] },
  { label: 'Data Quality', patterns: [/data quality/i, /data integrity/i] },
  { label: 'Cross-functional Collaboration', patterns: [/cross-functional/i, /product managers?/i, /designers?/i, /qa/i, /internal teams?/i] },
  { label: 'System Design', patterns: [/system design/i, /architecture/i, /highly available/i, /scalable/i] },
  { label: 'Feature Ownership', patterns: [/ownership/i, /own/i, /take ownership/i, /complex features?/i] },
  { label: 'Internal Tech Support', patterns: [/tech support/i, /hardware/i, /software troubleshooting/i, /network support/i] },
];

export const normalizeResponsibilityPoints = (item, evidenceMap = {}) => {
  const text = typeof item === 'string' ? item : item?.label || item?.text || '';
  const mapped = collectMappedPoints(text, RESPONSIBILITY_MAPPINGS, evidenceMap);
  if (mapped.length > 0) return mapped;
  const fallback = fallbackPoint(text);
  if (fallback) {
    evidenceMap[fallback] = [...new Set([...(evidenceMap[fallback] || []), text])];
    return [fallback];
  }
  return [];
};
