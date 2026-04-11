/**
 * File responsibility: Middleware.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: uploadMiddleware should apply request pipeline behaviour consistently across the application.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const isAllowedExtension = (filename = '') => {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.pdf' || ext === '.docx';
};

const isAllowedMimeType = (mimeType = '') => allowedMimeTypes.has(String(mimeType || '').toLowerCase());

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedExtension(file.originalname)) {
      return cb(new Error('Only PDF and DOCX files are allowed'));
    }

    if (!isAllowedMimeType(file.mimetype)) {
      return cb(new Error('Unsupported file type. Please upload a valid PDF or DOCX file.'));
    }

    return cb(null, true);
  },
}).single('cv');
