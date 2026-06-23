const BRACKET_PROMPT = /\[[^\]]{2,}\]/;
const MOJIBAKE = /(?:�|Ã|Â|â€|Š|Ÿ|Œ|Ð|Þ)/;
const CJK_PROMPT_WORDS = /(?:補充|說明|釐清|列出|假設|限制|風險|驗證)/;

export const validateAnswerRewrite = ({ question = '', weak = '', better = '' } = {}) => {
  const text = String(better || '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const reasons = [
    !text ? 'missing_text' : null,
    BRACKET_PROMPT.test(text) ? 'contains_bracket_prompt' : null,
    MOJIBAKE.test(text) ? 'contains_mojibake' : null,
    CJK_PROMPT_WORDS.test(text) ? 'contains_non_english_scaffold' : null,
    words.length > 120 ? 'too_long' : null,
    text === String(weak || '').trim() ? 'unchanged_answer' : null,
    !String(question || '').trim() ? 'missing_question' : null,
  ].filter(Boolean);

  return { valid: reasons.length === 0, reasons, wordCount: words.length };
};

