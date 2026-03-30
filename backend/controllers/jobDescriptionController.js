import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { callDeepSeek } from '../services/deepseekService.js';

export const paraphraseJD = async (req, res, next) => {
  try {
    const { rawJD } = req.body;
    if (!rawJD) {
      return res.status(400).json(formatError('Missing rawJD', 'MISSING_PARAM', 'Please provide raw job description text'));
    }

    const prompt = `
      Paraphrase and restructure the following job description into a concise format:
      1. Job Title
      2. What this job does
      3. Qualifications
      4. Needed Skills
      5. Must-have requirements
      6. Nice-to-have experience
      
      Job Description:
      ${rawJD}
    `;

    let structuredJD = '';
    try {
      structuredJD = await callDeepSeek(prompt);
    } catch (e) {
      console.warn('DeepSeek call failed, using fallback mock data:', e);
      // Fallback if API key is not set or fails
      structuredJD = `
1. Job Title: Extracted Role
2. What this job does: (Extracted from your text)
3. Qualifications: (Extracted from your text)
4. Needed Skills: (Extracted from your text)
5. Must-have requirements: (Extracted from your text)
6. Nice-to-have experience: (Extracted from your text)

Note: This is a fallback summary because the DeepSeek API key is not configured or the request failed.
      `.trim();
    }

    res.json(formatSuccess('Job description paraphrased successfully', { structuredJD }));
  } catch (error) {
    next(error);
  }
};
