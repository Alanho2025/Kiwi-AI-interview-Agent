import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import {
  buildStructuredJobDescriptionRubric,
  formatStructuredJobDescription,
} from '../services/jobDescriptionService.js';

export const paraphraseJD = async (req, res, next) => {
  try {
    const { rawJD } = req.body;
    if (!rawJD) {
      return res.status(400).json(formatError('Missing rawJD', 'MISSING_PARAM', 'Please provide raw job description text'));
    }

    const structuredJDRubric = await buildStructuredJobDescriptionRubric(rawJD);
    const structuredJD = formatStructuredJobDescription(structuredJDRubric);

    res.json(formatSuccess('Job description paraphrased successfully', {
      structuredJD,
      structuredJDRubric,
    }));
  } catch (error) {
    next(error);
  }
};
