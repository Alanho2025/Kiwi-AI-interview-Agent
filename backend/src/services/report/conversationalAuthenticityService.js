import { ensureArray } from '../../utils/commonHelpers.js';

const STAR_MARKERS = [
  /the situation was/i,
  /my task was/i,
  /the action i took/i,
  /as a result/i,
  /in reflection/i,
  /to summarize the result/i,
];

const NATURAL_TRANSITIONS = [
  /to give you an example/i,
  /what i learned from this/i,
  /looking back/i,
  /i realized that/i,
  /the main challenge was/i,
  /we decided to/i,
  /so i ended up/i,
];

export const evaluateAuthenticity = ({ transcript = [] } = {}) => {
  const userTurns = ensureArray(transcript).filter((t) => t.role === 'user');
  if (!userTurns.length) {
    return {
      scriptedRisk: 'low',
      conversationalFlowScore: 5,
      overStructuredStarRisk: 0,
      naturalTransitionScore: 5,
      personalVoiceScore: 5,
      reason: 'Not enough transcript data to evaluate authenticity.',
    };
  }

  let starMarkerCount = 0;
  let naturalTransitionCount = 0;
  let totalIStatements = 0;

  userTurns.forEach((turn) => {
    const text = turn.text || '';
    
    STAR_MARKERS.forEach((marker) => {
      if (marker.test(text)) starMarkerCount++;
    });

    NATURAL_TRANSITIONS.forEach((marker) => {
      if (marker.test(text)) naturalTransitionCount++;
    });

    const iMatches = text.match(/\bI\b/g);
    if (iMatches) totalIStatements += iMatches.length;
  });

  // Calculate overStructuredStarRisk (0-10)
  // High risk if they use explicit "The situation was..." phrases a lot
  let overStructuredStarRisk = Math.min(10, starMarkerCount * 2.5);

  // Calculate naturalTransitionScore (0-10)
  let naturalTransitionScore = Math.min(10, (naturalTransitionCount * 1.5) + 3);

  // Calculate personalVoiceScore (0-10)
  // Personal voice comes from using "I" and having natural transitions
  let personalVoiceScore = Math.min(10, (totalIStatements / Math.max(1, userTurns.length)) * 1.5 + 4);

  // Conversational flow
  let conversationalFlowScore = Math.min(10, Math.max(0, naturalTransitionScore - (overStructuredStarRisk / 2) + 2));

  let scriptedRisk = 'low';
  let reason = 'The candidate communicates naturally and blends structure with personal voice well.';

  if (overStructuredStarRisk >= 7) {
    scriptedRisk = 'high';
    reason = 'The candidate relies heavily on explicit STARR framework markers (e.g. "The situation was...", "My action was..."), making the answers sound slightly rehearsed or mechanical. Try to use more natural transitions while keeping the underlying structure.';
  } else if (overStructuredStarRisk >= 4 || naturalTransitionScore < 5) {
    scriptedRisk = 'medium';
    reason = 'The candidate uses a clear structure but occasionally sounds a bit formal or rehearsed. Blending in more natural transitions and personal reflections would improve authenticity.';
  }

  return {
    scriptedRisk,
    conversationalFlowScore: Math.round(conversationalFlowScore * 10) / 10,
    overStructuredStarRisk: Math.round(overStructuredStarRisk * 10) / 10,
    naturalTransitionScore: Math.round(naturalTransitionScore * 10) / 10,
    personalVoiceScore: Math.round(personalVoiceScore * 10) / 10,
    reason,
  };
};
