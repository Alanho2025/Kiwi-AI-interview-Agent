#!/usr/bin/env node
/** Browser verification for durable recording upload recovery. */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const SESSION_ID = 'recording-recovery-session';
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4174);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for recording recovery E2E: ${error.message}`);
  }
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForHttp = async (url) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const startFrontendServer = async () => {
  if (process.env.FRONTEND_BASE_URL) {
    await waitForHttp(BASE_URL);
    return null;
  }
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const server = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, VITE_API_BASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(BASE_URL);
  return server;
};

const success = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, message: 'ok', data, error: null }),
});

const installApiMocks = async (page) => {
  const calls = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);

    if (request.method() === 'POST' && url.pathname === '/api/recordings/session-audio/uploads') {
      await route.fulfill(success({ uploadId: 'upload-recovery-1', state: 'receiving' }));
      return;
    }
    if (request.method() === 'PUT' && /\/chunks\/\d+$/.test(url.pathname)) {
      await route.fulfill(success({ state: 'receiving' }));
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/finalize')) {
      await route.fulfill(success({ state: 'queued' }));
      return;
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/download')) {
      await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'non-empty-mp3' });
      return;
    }
    if (url.pathname === '/api/auth/csrf') {
      await route.fulfill(success({ csrfToken: 'e2e-csrf' }));
      return;
    }
    await route.fulfill(success({ authenticated: true, user: { id: 'e2e-user' } }));
  });
  return calls;
};

const createManagerInBrowser = async (page) => page.evaluate(async ({ sessionId }) => {
  const [{ createIndexedDbRecordingChunkStore }, { createRecordingUploadManager }] = await Promise.all([
    import('/src/runtime/recording/indexedDbRecordingChunkStore.js'),
    import('/src/runtime/recording/recordingUploadManager.js'),
  ]);
  const readData = async (response) => {
    if (!response.ok) throw new TypeError(`Request failed: ${response.status}`);
    return (await response.json()).data;
  };
  const api = {
    initialize: ({ sessionId: id, mimeType }) => fetch('/api/recordings/session-audio/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, mimeType }),
    }).then(readData),
    uploadChunk: ({ uploadId, sequence, checksum, blob }) => {
      const body = new FormData();
      body.append('checksum', checksum);
      body.append('audio', blob, `recording-${sequence}.webm`);
      return fetch(`/api/recordings/session-audio/uploads/${uploadId}/chunks/${sequence}`, {
        method: 'PUT',
        body,
      }).then(readData);
    },
    finalize: ({ uploadId, totalChunks, totalBytes }) => fetch(
      `/api/recordings/session-audio/uploads/${uploadId}/finalize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalChunks, totalBytes }),
      },
    ).then(readData),
  };
  const store = createIndexedDbRecordingChunkStore();
  window.recordingRecovery = {
    manager: createRecordingUploadManager({ sessionId, store, api }),
    store,
  };
}, { sessionId: SESSION_ID });

const run = async () => {
  const { chromium } = loadPlaywright();
  const server = await startFrontendServer();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
    });
    const page = await context.newPage();
    const calls = await installApiMocks(page);
    await page.goto(BASE_URL);
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('kiwi-recording-uploads');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    }));
    await createManagerInBrowser(page);

    await context.setOffline(true);
    const offlineSnapshot = await page.evaluate(async () => {
      const { manager, store } = window.recordingRecovery;
      manager.stop();
      await manager.enqueueChunk({ sequence: 0, blob: new Blob(['first']), mimeType: 'audio/webm' });
      await manager.enqueueChunk({ sequence: 1, blob: new Blob(['second']), mimeType: 'audio/webm' });
      const firstFinalization = manager.finalizeLocalCapture({ totalChunks: 2, totalBytes: 11 });
      const duplicateFinalization = manager.finalizeLocalCapture({ totalChunks: 2, totalBytes: 11 });
      if (firstFinalization !== duplicateFinalization) throw new Error('Local finalization was not idempotent');
      await firstFinalization;
      await manager.start();
      return {
        snapshot: manager.getSnapshot(),
        chunkCount: (await store.listChunks('recording-recovery-session')).length,
      };
    });
    if (offlineSnapshot.chunkCount !== 2 || offlineSnapshot.snapshot.state !== 'waiting_for_network') {
      throw new Error(`Offline chunks were not retained: ${JSON.stringify(offlineSnapshot)}`);
    }

    await context.setOffline(false);
    await page.reload();
    await createManagerInBrowser(page);
    const recovered = await page.evaluate(async () => {
      const { manager, store } = window.recordingRecovery;
      await manager.start();
      return {
        snapshot: manager.getSnapshot(),
        chunkCount: (await store.listChunks('recording-recovery-session')).length,
      };
    });
    if (recovered.chunkCount !== 0 || recovered.snapshot.state !== 'queued') {
      throw new Error(`Reload recovery did not finish: ${JSON.stringify(recovered)}`);
    }

    const downloadBytes = await page.evaluate(async ({ sessionId }) => {
      const response = await fetch(`/api/recordings/session-audio/${sessionId}/download`);
      return (await response.arrayBuffer()).byteLength;
    }, { sessionId: SESSION_ID });
    if (downloadBytes < 1) throw new Error('Downloaded MP3 was empty');

    const chunkCalls = calls.filter((call) => call.includes('/chunks/'));
    const finalizeCalls = calls.filter((call) => call.endsWith('/finalize'));
    if (chunkCalls.length !== 2 || finalizeCalls.length !== 1) {
      throw new Error(`Expected two chunk uploads and one finalize: ${JSON.stringify(calls)}`);
    }
    console.log(JSON.stringify({ passed: true, chunkCalls, finalizeCalls, downloadBytes }, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
