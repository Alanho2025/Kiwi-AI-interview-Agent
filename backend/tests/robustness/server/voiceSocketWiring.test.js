/**
 * File responsibility: Server voice socket wiring robustness tests.
 * Main responsibilities:
 * - Guard against shipping frontend duplex voice without the backend socket mounted.
 * - Keep live STT and duplex voice transports attached from the HTTP entry point.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readEntrySource = () => readFileSync(resolve(process.cwd(), 'index.js'), 'utf8');

describe('voice socket server wiring', () => {
  it('mounts both live STT and duplex voice WebSocket servers from the backend entry point', () => {
    const source = readEntrySource();

    expect(source).toContain("import { attachRealtimeVoiceSocketServer } from './src/api/realtimeVoiceSocket.js';");
    expect(source).toContain("import { attachDuplexVoiceSocketServer } from './src/api/duplexVoiceSocket.js';");
    expect(source).toMatch(/attachRealtimeVoiceSocketServer\(server\);/);
    expect(source).toMatch(/attachDuplexVoiceSocketServer\(server\);/);
  });
});
