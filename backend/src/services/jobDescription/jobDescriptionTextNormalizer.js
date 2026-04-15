import { preprocessJobDescriptionText } from './jobDescriptionPreprocessor.js';

export const normalizeJobDescriptionText = (rawText = '') => preprocessJobDescriptionText(rawText);
