import WebSocket from 'ws';

const REALTIME_STT_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const DEFAULT_MODEL_ID = 'scribe_v2_realtime';
const DEFAULT_COMMIT_STRATEGY = 'vad';
const DEFAULT_FINAL_TIMEOUT_MS = 5000;
const DEFAULT_CLOSE_TIMEOUT_MS = 1000;
const MAX_KEYTERMS = 50;
const MAX_KEYTERM_LENGTH = 20;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeLanguageCode = (language) => String(language || 'en').trim().toLowerCase().split('-')[0] || 'en';
const normalizeCommitStrategy = (value) => {
  const strategy = String(value || DEFAULT_COMMIT_STRATEGY).trim().toLowerCase();
  return strategy === 'manual' ? 'manual' : 'vad';
};

const normalizeKeyterm = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_KEYTERM_LENGTH);

const splitConfiguredKeyterms = () => String(process.env.ELEVENLABS_STT_KEYTERMS || '')
  .split(',')
  .map((term) => term.trim())
  .filter(Boolean);

const buildKeyterms = (fixtureKeyterms = []) => {
  const seen = new Set();
  const keyterms = [];

  for (const value of [...fixtureKeyterms, ...splitConfiguredKeyterms()]) {
    const keyterm = normalizeKeyterm(value);
    const lookupKey = keyterm.toLowerCase();
    if (!keyterm || seen.has(lookupKey)) continue;
    seen.add(lookupKey);
    keyterms.push(keyterm);
    if (keyterms.length >= MAX_KEYTERMS) break;
  }

  return keyterms;
};

const buildRealtimeUrl = ({ language, keyterms, commitStrategy }) => {
  const url = new URL(REALTIME_STT_URL);
  url.searchParams.set('model_id', process.env.ELEVENLABS_STT_MODEL_ID || DEFAULT_MODEL_ID);
  url.searchParams.set('audio_format', process.env.ELEVENLABS_STT_AUDIO_FORMAT || 'pcm_16000');
  url.searchParams.set('language_code', normalizeLanguageCode(language));
  url.searchParams.set('commit_strategy', commitStrategy);
  url.searchParams.set('include_timestamps', process.env.ELEVENLABS_STT_INCLUDE_TIMESTAMPS || 'false');
  if (commitStrategy === 'vad') {
    url.searchParams.set('vad_silence_threshold_secs', process.env.ELEVENLABS_STT_VAD_SILENCE_THRESHOLD_SECS || '0.8');
    url.searchParams.set('vad_threshold', process.env.ELEVENLABS_STT_VAD_THRESHOLD || '0.4');
    url.searchParams.set('min_speech_duration_ms', process.env.ELEVENLABS_STT_MIN_SPEECH_DURATION_MS || '300');
    url.searchParams.set('min_silence_duration_ms', process.env.ELEVENLABS_STT_MIN_SILENCE_DURATION_MS || '300');
  }
  keyterms.forEach((keyterm) => url.searchParams.append('keyterms', keyterm));
  return url;
};

const waitForOpen = (socket) => new Promise((resolve, reject) => {
  const cleanup = () => {
    socket.off('open', handleOpen);
    socket.off('error', handleError);
  };
  const handleOpen = () => {
    cleanup();
    resolve();
  };
  const handleError = (error) => {
    cleanup();
    reject(error);
  };

  socket.once('open', handleOpen);
  socket.once('error', handleError);
});

const waitForClose = (socket) => new Promise((resolve) => {
  if (socket.readyState === WebSocket.CLOSED) {
    resolve();
    return;
  }
  socket.once('close', () => resolve());
});

const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  promise
    .then((value) => {
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
});

const parseEvent = (data) => {
  try {
    return JSON.parse(data.toString('utf8'));
  } catch {
    return null;
  }
};

const createFinalWaiter = () => {
  let resolveFinal;
  const finalPromise = new Promise((resolve) => {
    resolveFinal = resolve;
  });
  return { finalPromise, resolveFinal };
};

const getEventErrorMessage = (event) => event?.message || event?.error || event?.detail || event?.reason || 'ElevenLabs realtime STT error';

export const createElevenLabsRealtimeSttProvider = async ({ sampleRate, language, callbacks, fixture }) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('Set ELEVENLABS_API_KEY before running the ElevenLabs realtime STT benchmark.');
  if (sampleRate !== 16000) throw new Error(`ElevenLabs realtime STT benchmark expects 16 kHz PCM audio. Received ${sampleRate}.`);

  const keyterms = buildKeyterms(fixture?.keywords || []);
  const commitStrategy = normalizeCommitStrategy(process.env.ELEVENLABS_STT_COMMIT_STRATEGY);
  const socket = new WebSocket(buildRealtimeUrl({ language, keyterms, commitStrategy }), { headers: { 'xi-api-key': apiKey } });
  const finalTimeoutMs = parsePositiveInteger(process.env.ELEVENLABS_STT_FINAL_TIMEOUT_MS, DEFAULT_FINAL_TIMEOUT_MS);
  const closeTimeoutMs = parsePositiveInteger(process.env.ELEVENLABS_STT_CLOSE_TIMEOUT_MS, DEFAULT_CLOSE_TIMEOUT_MS);
  const finalWaiter = createFinalWaiter();
  const errors = [];
  let pendingChunk = null;
  let sawCommittedTranscript = false;

  socket.on('message', (data) => {
    const event = parseEvent(data);
    if (!event) {
      callbacks.onError('Invalid ElevenLabs realtime STT JSON event.');
      return;
    }

    if (event.message_type === 'partial_transcript') {
      callbacks.onPartial({ text: event.text, provider: 'elevenlabs-realtime', raw: event });
      return;
    }

    if (event.message_type === 'committed_transcript' || event.message_type === 'committed_transcript_with_timestamps') {
      const text = String(event.text || '').trim();
      if (text) callbacks.onFinal({ text, displayText: text, provider: 'elevenlabs-realtime', raw: event });
      sawCommittedTranscript = true;
      finalWaiter.resolveFinal();
      return;
    }

    if (String(event.message_type || '').toLowerCase().includes('error')) {
      const message = getEventErrorMessage(event);
      errors.push(message);
      callbacks.onError(message);
      finalWaiter.resolveFinal();
    }
  });

  socket.on('error', (error) => {
    const message = error?.message || String(error);
    errors.push(message);
    callbacks.onError(message);
    finalWaiter.resolveFinal();
  });

  socket.on('close', (code, reason) => {
    if (!sawCommittedTranscript && code !== 1000) {
      const message = `ElevenLabs realtime STT socket closed before final transcript: ${code} ${reason?.toString('utf8') || ''}`.trim();
      errors.push(message);
      callbacks.onError(message);
    }
    finalWaiter.resolveFinal();
  });

  await waitForOpen(socket);

  const sendChunk = (chunk, commit) => {
    if (!chunk?.length && !commit) return;
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: Buffer.from(chunk || Buffer.alloc(0)).toString('base64'),
      commit,
      sample_rate: sampleRate,
    }));
  };

  return {
    name: 'elevenlabs-realtime',
    write: (chunk) => {
      if (commitStrategy === 'manual') {
        if (pendingChunk) sendChunk(pendingChunk, false);
        pendingChunk = Buffer.from(chunk);
        return;
      }
      sendChunk(chunk, false);
    },
    finalize: async () => {
      if (commitStrategy === 'manual') {
        sendChunk(pendingChunk || Buffer.alloc(0), true);
      } else if (pendingChunk) {
        sendChunk(pendingChunk, false);
      }
      pendingChunk = null;
      await withTimeout(
        finalWaiter.finalPromise,
        finalTimeoutMs,
        `Timed out waiting ${finalTimeoutMs}ms for ElevenLabs ${commitStrategy} committed transcript.`
      );
      if (socket.readyState === WebSocket.OPEN) socket.close(1000, 'benchmark complete');
      await withTimeout(
        waitForClose(socket),
        closeTimeoutMs,
        `Timed out waiting ${closeTimeoutMs}ms for ElevenLabs realtime STT socket close.`
      ).catch(() => {
        if (typeof socket.terminate === 'function') socket.terminate();
      });
      if (errors.length) throw new Error(errors[0]);
    },
    integrationComplexity: 'medium: cloud realtime STT over WebSocket; consumes existing 16 kHz PCM chunks and supports fixture keyword bias',
    benchmarkMetadata: {
      modelId: process.env.ELEVENLABS_STT_MODEL_ID || DEFAULT_MODEL_ID,
      audioFormat: process.env.ELEVENLABS_STT_AUDIO_FORMAT || 'pcm_16000',
      commitStrategy,
      keyterms,
      keytermCount: keyterms.length,
    },
  };
};
