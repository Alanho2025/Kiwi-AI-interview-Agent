import { formatError } from '../utils/responseFormatter.js';

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  if (err.message === 'Only PDF and DOCX files are allowed') {
    return res.status(400).json(formatError('Validation failed', 'VALIDATION_ERROR', err.message));
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(formatError('Validation failed', 'VALIDATION_ERROR', 'File size exceeds 5MB limit'));
  }

  res.status(500).json(formatError('Internal server error', 'SERVER_ERROR', err.message));
};
