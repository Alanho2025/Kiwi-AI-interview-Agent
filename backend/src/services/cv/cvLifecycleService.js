import { query } from '../../db/postgres.js';
import { DocumentContent } from '../../db/models/documentContentModel.js';
import { buildCvProfile } from './cvProfileBuilderService.js';
import { buildCvDisplayView } from './cvDisplayViewService.js';
import { getOwnedCvDocumentOrThrow, getOwnedCvRecordOrThrow } from './cvOwnershipService.js';

export const rebuildOwnedCvProfile = async ({ cvId, userId }) => {
  const cvDocument = await getOwnedCvDocumentOrThrow({ cvId, userId });
  const cvRecord = await getOwnedCvRecordOrThrow({ cvId, userId });
  const cvProfile = buildCvProfile(cvDocument.rawText || cvDocument.normalizedText || '');
  const displayProfile = buildCvDisplayView({
    fileRecord: {
      id: cvId,
      original_filename: cvRecord.name,
      mime_type: cvRecord.type,
      uploaded_at: new Date().toISOString(),
    },
    cvProfile,
  });

  await DocumentContent.findOneAndUpdate(
    { fileId: cvId, userId },
    {
      cvProfile,
      displayProfile,
      extractedSections: cvProfile.sections || [],
      parseWarnings: cvProfile.warnings || [],
      parseConfidence: cvProfile.confidence || 0.5,
      normalizedText: cvDocument.normalizedText || cvDocument.rawText || '',
      redactedText: displayProfile.summary || '',
      cvProfileVersion: 'cv_profile_v2',
      parserVersion: 'cv_parser_v2',
    },
    { returnDocument: 'after' }
  );

  return getOwnedCvRecordOrThrow({ cvId, userId });
};

export const softDeleteOwnedCv = async ({ cvId, userId }) => {
  await getOwnedCvRecordOrThrow({ cvId, userId });
  await query(
    `UPDATE uploaded_files
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND file_role = 'cv' AND deleted_at IS NULL`,
    [cvId, userId]
  );
  await DocumentContent.findOneAndUpdate(
    { fileId: cvId, userId },
    { deletedAt: new Date() },
    { returnDocument: 'after' }
  );
  return { deleted: true, cvId };
};

export const exportOwnedCvData = async ({ cvId, userId }) => {
  const cvRecord = await getOwnedCvRecordOrThrow({ cvId, userId });
  const cvDocument = await getOwnedCvDocumentOrThrow({ cvId, userId });

  return {
    exportedAt: new Date().toISOString(),
    cv: {
      id: cvRecord.id,
      name: cvRecord.name,
      type: cvRecord.type,
      updated: cvRecord.updated,
      parseStatus: cvRecord.parseStatus,
      profileStatus: cvRecord.profileStatus,
      candidateName: cvRecord.candidateName,
      summary: cvRecord.summary,
      warnings: cvRecord.warnings,
      display: cvRecord.display,
      profile: cvRecord.profile,
    },
    lifecycle: {
      storagePolicy: 'local_file_and_document_record',
      exportScope: 'redacted_display_and_normalized_profile',
      rawTextIncluded: false,
      retentionUntil: cvDocument.retentionUntil || null,
    },
  };
};
