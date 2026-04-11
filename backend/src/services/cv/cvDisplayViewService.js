/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: cvDisplayViewService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

const maskEmail = (email = '') => {
  if (!email.includes('@')) {
    return '';
  }

  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `**@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
};

const maskPhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) {
    return '';
  }

  return `***${digits.slice(-4)}`;
};

const buildPreviewSections = (sections = []) => sections
  .filter((section) => section.key !== 'header')
  .slice(0, 4)
  .map((section) => ({
    key: section.key,
    title: section.title,
    preview: section.content.slice(0, 180),
  }));

export const buildCvDisplayView = ({ fileRecord, cvProfile }) => ({
  fileId: fileRecord.id,
  name: fileRecord.original_filename,
  type: fileRecord.mime_type,
  uploadedAt: fileRecord.uploaded_at,
  candidateName: cvProfile.candidateName,
  contact: {
    email: maskEmail(cvProfile.contact?.email || ''),
    phone: maskPhone(cvProfile.contact?.phone || ''),
    location: cvProfile.contact?.location || '',
  },
  summary: cvProfile.summary || cvProfile.experience.slice(0, 180) || '',
  topSkills: (cvProfile.skills || []).slice(0, 8).map((item) => item.label),
  previewSections: buildPreviewSections(cvProfile.sections || []),
  warnings: cvProfile.warnings || [],
  parseStatus: 'completed',
  profileStatus: 'completed',
});
