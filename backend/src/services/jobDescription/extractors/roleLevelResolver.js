const normalise = (text = '') => String(text || '').replace(/\s+/g, ' ').trim();

export const resolveRoleLevel = ({ title = '', flatText = '' } = {}) => {
  const head = normalise(title);
  const combined = `${head} ${normalise(flatText)}`.trim();
  const evidence = [];

  if (/graduate programme/i.test(head)) return { value: 'graduate', confidence: 0.98, evidence: ['graduate programme title'] };
  if (/\b(?:principal|staff)\b/i.test(head)) return { value: 'staff_plus', confidence: 0.98, evidence: [head] };
  if (/\bmanager\b/i.test(head)) return { value: 'leadership', confidence: 0.96, evidence: [head] };
  if (/\b(?:lead|head of)\b/i.test(head)) return { value: 'lead', confidence: 0.96, evidence: [head] };
  if (/\bsenior\b/i.test(head)) return { value: 'senior', confidence: 0.96, evidence: [head] };
  if (/\b(?:junior|entry level|entry-level|associate)\b/i.test(head)) return { value: 'junior', confidence: 0.95, evidence: [head] };
  if (/\bgraduate\b/i.test(head) && !/post ?graduate/i.test(head)) return { value: 'graduate', confidence: 0.95, evidence: [head] };

  if (/\b[7-9]\+? years?\b/i.test(combined) || /\b10\+? years?\b/i.test(combined)) {
    evidence.push(combined.match(/\b(?:[7-9]\+? years?|10\+? years?)\b/i)?.[0] || '7+ years');
    return { value: 'senior', confidence: 0.9, evidence };
  }
  if (/\b[5-6]\+? years?\b/i.test(combined) || /mentor|architectural decisions|take ownership of complex features/i.test(combined)) {
    evidence.push(combined.match(/\b[5-6]\+? years?\b/i)?.[0] || 'ownership or mentoring signal');
    return { value: 'senior', confidence: 0.85, evidence };
  }
  if (/\b[2-4]\+? years?\b/i.test(combined) || /\b(?:intermediate|mid)\b/i.test(combined)) {
    evidence.push(combined.match(/\b(?:[2-4]\+? years?|intermediate|mid)\b/i)?.[0] || 'mid signal');
    return { value: 'mid', confidence: 0.82, evidence };
  }
  if (/\bgraduate\b/i.test(combined) && !/post ?graduate/i.test(combined)) return { value: 'graduate', confidence: 0.72, evidence: ['graduate signal outside title'] };
  if (/\b(?:intern|apprentice)\b/i.test(combined)) return { value: 'intern', confidence: 0.85, evidence: ['intern signal'] };
  if (/\b(?:junior|entry level|entry-level|associate)\b/i.test(combined)) return { value: 'junior', confidence: 0.8, evidence: ['junior signal'] };
  return { value: 'mid', confidence: 0.6, evidence: ['default mid fallback'] };
};
