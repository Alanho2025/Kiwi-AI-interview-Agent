const normalizeLine = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

export const buildFieldEvidence = ({ rawJD = '', values = {} }) => {
  const lines = String(rawJD || '').split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const evidence = {};

  for (const [field, value] of Object.entries(values)) {
    if (!value) continue;
    const match = lines.find((line) => line.toLowerCase().includes(String(value).toLowerCase()));
    evidence[field] = match ? [match] : [];
  }

  return evidence;
};
