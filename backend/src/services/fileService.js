import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const normalizeExtractedText = (text) =>
  text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const extractTextFromPdf = async (fileBuffer) => {
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });

  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text || '');
  } finally {
    await parser.destroy();
  }
};

const extractTextFromDocx = async (fileBuffer) => {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return normalizeExtractedText(result.value || '');
};

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
