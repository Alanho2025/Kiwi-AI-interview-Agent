import { asyncHandler } from '../middleware/asyncHandler.js';
import { formatSuccess } from '../utils/responseFormatter.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { buildOpsLiteSummary } from '../services/opsLiteService.js';
import { buildHumanCalibrationPilot } from '../services/humanCalibrationService.js';

export const getOpsLiteSummary = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const summary = await buildOpsLiteSummary({ userId: user.id });
  res.json(formatSuccess('Ops-lite summary retrieved', {
    ...summary,
    humanCalibration: buildHumanCalibrationPilot(),
  }));
});
