import { DocumentContent } from '../db/models/documentContentModel.js';

export const upsertDocumentContent = async ({
  fileId,
  sessionId = null,
  userId,
  documentType,
  rawText,
  normalizedText,
  redactedText = '',
}) =>
  DocumentContent.findOneAndUpdate(
    { fileId },
    {
      fileId,
      sessionId,
      userId,
      documentType,
      rawText,
      normalizedText,
      redactedText,
      parseStatus: 'completed',
      containsSensitiveData: true,
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

export const findDocumentsByFileIds = async (fileIds) =>
  DocumentContent.find({ fileId: { $in: fileIds } }).lean();

export const findDocumentByFileId = async (fileId) =>
  DocumentContent.findOne({ fileId }).lean();
