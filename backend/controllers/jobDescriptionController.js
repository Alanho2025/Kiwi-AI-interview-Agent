import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import {
  buildStructuredJobDescriptionRubric,
  formatStructuredJobDescription,
} from '../services/jobDescriptionService.js';

export const paraphraseJD = async (req, res, next) => {
  console.log('ENTERING paraphraseJD');
  try {
    const { rawJD } = req.body;
    if (!rawJD) {
      return res.status(400).json(formatError('Missing rawJD', 'MISSING_PARAM', 'Please provide raw job description text'));
    }

    console.log('Calling jobDescriptionService buildStructuredJobDescriptionRubric');
    const structuredJDRubric = await buildStructuredJobDescriptionRubric(rawJD);
    const structuredJD = formatStructuredJobDescription(structuredJDRubric);

    console.log('EXITING paraphraseJD successfully');
    res.json(formatSuccess('Job description paraphrased successfully', {
      structuredJD,
      structuredJDRubric,
    }));
  } catch (error) {
    console.error('ERROR in paraphraseJD:', error.message, error.stack);
    next(error);
  }
};
