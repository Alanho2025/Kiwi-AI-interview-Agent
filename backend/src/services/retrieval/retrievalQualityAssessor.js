import { ensureArray } from '../../utils/commonHelpers.js';

const normalize = (value = '') => String(value || '').toLowerCase();

export const assessRetrievalQuality = ({ retrievalResult = {}, targetTopic = '' } = {}) => {
  const items = ensureArray(retrievalResult.items);
  const topic = normalize(targetTopic);

  if (!items.length) {
    return {
      passed: false,
      reasons: ['NO_RESULTS'],
      retryRecommended: true,
      score: 0,
    };
  }

  const topicAlignmentHits = topic
    ? items.filter((item) => normalize(item.text).includes(topic) || normalize(item.metadata?.topic).includes(topic)).length
    : items.length;
  const topFusion = Number(items[0]?.scores?.fusion || 0);
  const genericCount = items.filter((item) => normalize(item.text).split(/\s+/).length < 8).length;
  const score = Number(((Math.min(1, topFusion * 2) * 0.55) + ((topicAlignmentHits / items.length) * 0.3) + ((1 - (genericCount / items.length)) * 0.15)).toFixed(4));
  const reasons = [];

  if (topic && topicAlignmentHits === 0) reasons.push('LOW_TOPIC_ALIGNMENT');
  if (topFusion < 0.12) reasons.push('LOW_FUSION_SCORE');
  if (genericCount === items.length) reasons.push('GENERIC_EVIDENCE');

  return {
    passed: reasons.length === 0,
    reasons,
    retryRecommended: reasons.length > 0,
    score,
  };
};
