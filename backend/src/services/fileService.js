/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: fileService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * Purpose: Execute the main responsibility for normalizeExtractedText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeExtractedText = (text) =>
  text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/**
 * Purpose: Execute the main responsibility for extractTextFromPdf.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const extractTextFromPdf = async (fileBuffer) => {
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });

  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text || '');
  } finally {
    await parser.destroy();
  }
};

/**
 * Purpose: Execute the main responsibility for extractTextFromDocx.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const extractTextFromDocx = async (fileBuffer) => {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return normalizeExtractedText(result.value || '');
};

/**
 * Purpose: Execute the main responsibility for extractTextFromCV.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const extractTextFromCV = async (fileBuffer, mimeType) => {
  if (!fileBuffer?.length) {
    throw new Error('Uploaded file is empty');
  }

  if (mimeType === 'application/pdf') {
    return extractTextFromPdf(fileBuffer);
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(fileBuffer);
  }

  throw new Error('Unsupported file type');
};
