from pathlib import Path

path = Path("backend/src/services/voice/speechConfidenceGate.js")
text = path.read_text()

# 1. Add contentful low-confidence thresholds
old_rules = """  unknownMinWords: 8,
  unknownMinSpeechMs: 3500,
};"""

new_rules = """  unknownMinWords: 8,
  unknownMinSpeechMs: 3500,
  lowConfidenceContentfulMinWords: 25,
  lowConfidenceContentfulMinCharacters: 120,
  lowConfidenceContentfulMinSpeechMs: 8000,
};"""

if "lowConfidenceContentfulMinWords" not in text:
    text = text.replace(old_rules, new_rules)

# 2. Allow long/contentful low-confidence answers to continue
old_low_confidence = """  if (confidenceGate.status === 'low') {
    return traceGateDecision({
      ok: false,
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
      message: 'Voice recognition was not confident it heard that correctly. Please repeat your answer from the start.',
      ...basePayload,
    }, traceContext);
  }"""

new_low_confidence = """  if (confidenceGate.status === 'low') {
    const hasContentfulAnswer = words >= rules.lowConfidenceContentfulMinWords
      && text.length >= rules.lowConfidenceContentfulMinCharacters
      && speechDurationMs >= rules.lowConfidenceContentfulMinSpeechMs
      && (sttSegmentCount === null || sttSegmentCount > 0);

    if (hasContentfulAnswer) {
      const contentfulConfidenceGate = {
        ...confidenceGate,
        shouldConfirm: true,
        shouldRecordAgain: false,
      };

      return traceGateDecision({
        ok: true,
        reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
        message: 'I may not have heard every word perfectly, but I caught enough of your answer to continue.',
        confidenceGate: contentfulConfidenceGate,
        metrics: basePayload.metrics,
        transcriptQuality: 'low_confidence_but_contentful',
        shouldUseCautiousScoring: true,
      }, {
        ...traceContext,
        confidenceGate: contentfulConfidenceGate,
      });
    }

    return traceGateDecision({
      ok: false,
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
      message: 'Voice recognition was not confident it heard that correctly. Please repeat your answer from the start.',
      ...basePayload,
    }, traceContext);
  }"""

if "LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT" not in text:
    if old_low_confidence not in text:
        raise SystemExit("Could not find the original low-confidence block. File may already be changed or code differs.")
    text = text.replace(old_low_confidence, new_low_confidence)

path.write_text(text)
print("Updated:", path)
