import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('legacy batch voice removal robustness', () => {
  it('keeps removed batch WAV upload flow out of official routes and source files', () => {
    const routeSource = read('src/api/routes/interviewRoutes.js');
    const controllerSource = read('src/controllers/interviewTurnController.js');

    expect(routeSource).not.toMatch(/voice-reply|voiceUploadMiddleware|replyInterviewWithVoice\b/);
    expect(controllerSource).not.toMatch(/replyInterviewWithVoice\b/);
    expect(fs.existsSync(path.join(root, 'src/middleware/voiceUploadMiddleware.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'src/services/voice/voiceOrchestrationService.js'))).toBe(false);
  });
});
