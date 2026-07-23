import { createRequire } from 'node:module';

import { apiRequest, buildRoleFitRubric } from './e2eBackendHarness.mjs';

const require = createRequire(import.meta.url);

export const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for voice E2E: ${error.message}`, { cause: error });
  }
};

export const createPcmToneChunk = ({ sampleRate = 16000, durationMs = 80, amplitude = 0.28 } = {}) => {
  const sampleCount = Math.max(1, Math.round((sampleRate * durationMs) / 1000));
  const buffer = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const phase = (index / sampleRate) * Math.PI * 2 * 440;
    const value = Math.round(Math.sin(phase) * amplitude * 32767);
    buffer.writeInt16LE(value, index * 2);
  }
  return buffer;
};

const buildVoicePlanBody = ({ jdRubric, questionLimit = 3 }) => {
  const rawJD = 'Frontend Voice Systems Engineer role requiring React, WebSocket debugging, and voice latency instrumentation.';
  const analysisResult = {
    candidateName: 'Voice E2E Candidate',
    jobTitle: jdRubric.title,
    matchScore: 86,
    decision: { label: 'qualified', reasonCodes: ['role_fit_verified'] },
    strengths: ['React voice UX', 'WebSocket instrumentation'],
    gaps: ['Azure Speech production hardening'],
    requirementChecks: [
      { requirement: 'React voice UX', met: true, category: 'technical', evidenceStrength: 'strong' },
      { requirement: 'latency instrumentation', met: true, category: 'technical', evidenceStrength: 'strong' },
    ],
    matchingDetails: {
      questionPlanHints: {
        priorityTopics: ['duplex voice orchestration', 'latency debugging'],
      },
    },
    parsedJdProfile: jdRubric,
  };

  return {
    rawJD,
    jdText: rawJD,
    jdRubric,
    settings: {
      seniorityLevel: 'Mid-level',
      focusArea: 'Technical',
      questionType: 'Technical',
      controlMode: 'question',
      questionLimit,
      timeLimitMinutes: 30,
    },
    sessionSetup: {
      deliveryMode: 'voice',
      controlMode: 'question',
      questionLimit,
      timeLimitMinutes: 30,
      questionType: 'Technical',
    },
    analysisResult,
    mode: 'voice',
  };
};

export const createVoiceInterviewPlan = async ({
  backendBaseUrl,
  token,
  apiCalls,
  questionLimit = 3,
  jdFingerprint = 'voice-e2e-role-fit-fingerprint',
} = {}) => {
  const jdRubric = buildRoleFitRubric({ reviewStatus: 'verified', jdFingerprint });
  const plan = await apiRequest({
    backendBaseUrl,
    token,
    method: 'POST',
    endpoint: '/analyze/interview-plan',
    body: buildVoicePlanBody({ jdRubric, questionLimit }),
  });
  apiCalls?.push({ method: 'POST', path: '/api/analyze/interview-plan', status: plan.status });
  if (!plan.ok || !plan.data?.sessionId) {
    throw new Error(`Expected voice interview plan sessionId, got ${JSON.stringify(plan.data)}`);
  }
  return { sessionId: plan.data.sessionId, planResponse: plan.data, jdRubric };
};

export const installVoiceSocketTrace = async (context) => {
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__kiwiVoiceE2E = {
      voiceSocket: null,
      events: [],
      outboundTypes: [],
      inboundTypes: [],
    };

    window.WebSocket = function WebSocketWithVoiceTrace(url, protocols) {
      const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
      if (String(url).includes('/voice/duplex')) {
        window.__kiwiVoiceE2E.voiceSocket = socket;
        window.__kiwiVoiceE2E.events.push({ direction: 'socket', type: 'constructed', url: String(url), at: performance.now() });
      }

      const recordInboundMessage = (event) => {
        let payloadType = 'unknown';
        try {
          const payload = JSON.parse(String(event.data || '{}'));
          payloadType = payload.type || 'json_without_type';
          window.__kiwiVoiceE2E.events.push({
            direction: 'in',
            type: payloadType,
            text: payload.text || payload.displayText || payload.normalizedText || payload.transcription?.text || null,
            provider: payload.provider || payload.transcription?.asrSource || null,
            latency: payload.latency || null,
            interrupted: payload.interrupted ?? null,
            reason: payload.reason || null,
            countsAsQuestion: payload.metadata?.countsAsQuestion ?? payload.countsAsQuestion ?? null,
            at: performance.now(),
          });
        } catch {
          payloadType = 'unparseable_message';
        }
        window.__kiwiVoiceE2E.inboundTypes.push(payloadType);
      };

      const nativeSend = socket.send.bind(socket);
      socket.send = (data) => {
        let type = 'binary_audio';
        if (typeof data === 'string') {
          try {
            type = JSON.parse(data).type || 'json_without_type';
          } catch {
            type = 'unparseable_json';
          }
        }
        window.__kiwiVoiceE2E.outboundTypes.push(type);
        window.__kiwiVoiceE2E.events.push({ direction: 'out', type, at: performance.now() });
        return nativeSend(data);
      };

      socket.addEventListener('message', recordInboundMessage);
      return socket;
    };

    window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    window.WebSocket.OPEN = NativeWebSocket.OPEN;
    window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
    window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
    window.WebSocket.prototype = NativeWebSocket.prototype;
  });
};

export const collectBrowserDiagnostics = ({ page, apiCalls, browserErrors, includeClientErrors = false } = {}) => {
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && text.includes('[Voice Error]')) {
      browserErrors.push(`[console.error] ${text}`);
    }
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      apiCalls.push({ method: request.method(), path: url.pathname, phase: 'request' });
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) {
      apiCalls.push({ method: response.request().method(), path: url.pathname, phase: 'response', status: response.status() });
    }
    if (response.status() >= 500 || (includeClientErrors && response.status() >= 400)) {
      browserErrors.push(`[response] ${response.status()} ${response.url()}`);
    }
  });
};

export const driveVoiceTurnThroughSocket = async ({ page, speechDurationMs = 3200, audioChunks = 8 } = {}) => {
  const clientTurnId = `voice-e2e-${Date.now()}`;
  const pcmChunk = createPcmToneChunk();
  await page.waitForFunction(() => window.__kiwiVoiceE2E?.voiceSocket?.readyState === WebSocket.OPEN, null, { timeout: 15_000 });
  await page.waitForFunction(() => window.__kiwiVoiceE2E?.inboundTypes?.includes('session_ready'), null, { timeout: 15_000 });
  await page.evaluate(({ clientTurnId: turnId, audioBytes, speechDurationMs: durationMs, audioChunks: chunkCount }) => {
    const socket = window.__kiwiVoiceE2E.voiceSocket;
    socket.send(JSON.stringify({ type: 'speech_start', clientTurnId: turnId, clientTimestamp: Date.now() }));
    for (let index = 0; index < chunkCount; index += 1) {
      socket.send(Uint8Array.from(audioBytes).buffer);
    }
    socket.send(JSON.stringify({
      type: 'speech_end',
      clientTurnId: turnId,
      reason: 'voice_e2e',
      vad: {
        speechDurationMs: durationMs,
        silenceDurationMs: 1900,
        sttSource: 'e2e_real_backend_pcm',
      },
    }));
  }, {
    clientTurnId,
    audioBytes: [...pcmChunk],
    speechDurationMs,
    audioChunks,
  });
  return clientTurnId;
};

export const sendBargeInDuringAssistantSpeech = async ({ page } = {}) => {
  await page.waitForFunction(() => window.__kiwiVoiceE2E?.voiceSocket?.readyState === WebSocket.OPEN, null, { timeout: 15_000 });
  await page.waitForFunction(() => window.__kiwiVoiceE2E?.inboundTypes?.includes('session_ready'), null, { timeout: 30_000 });
  await page.evaluate(() => {
    const socket = window.__kiwiVoiceE2E.voiceSocket;
    socket.send(JSON.stringify({
      type: 'speak_text',
      text: 'This is a barge-in probe for the E2E test. The assistant should stop speaking when the user interrupts this spoken prompt.',
      index: 99,
      clientTimestamp: Date.now(),
    }));
    window.setTimeout(() => {
      socket.send(JSON.stringify({
        type: 'barge_in',
        reason: 'voice_network_barge_in_e2e',
        clientTimestamp: Date.now(),
      }));
    }, 30);
  });
  await page.waitForFunction(() => window.__kiwiVoiceE2E?.inboundTypes?.includes('barge_in_ack'), null, { timeout: 30_000 });
};

export const getQuestionProgressText = async (page) => page.evaluate(() => {
  const match = document.body.innerText.match(/Question\s+\d+\s+of\s+\d+/i);
  return match ? match[0].replace(/\s+/g, ' ') : null;
});

export const getVoiceTrace = async (page) => page.evaluate(() => {
  const state = window.__kiwiVoiceE2E || {};
  return {
    outboundTypes: state.outboundTypes || [],
    inboundTypes: state.inboundTypes || [],
    events: (state.events || []).map((event) => ({
      direction: event.direction,
      type: event.type,
      provider: event.provider || null,
      text: event.text || null,
      latency: event.latency || null,
      interrupted: event.interrupted ?? null,
      reason: event.reason || null,
      countsAsQuestion: event.countsAsQuestion ?? null,
      at: Math.round(event.at || 0),
    })),
  };
});

export const findFirstAudioAfterSpeechEnd = (events = []) => {
  const speechEndEvent = events.find((event) => event.direction === 'out' && event.type === 'speech_end');
  if (!speechEndEvent) return { speechEndEvent: null, firstAudioEvent: null, nextQuestionFirstAudioMs: null };
  const audioEvents = events.filter((event) => (
    event.direction === 'in'
    && event.at >= speechEndEvent.at
    && ['tts_audio_chunk', 'audio_chunk'].includes(event.type)
  ));
  const firstAudioEvent = audioEvents[0] || null;
  return {
    speechEndEvent,
    firstAudioEvent,
    nextQuestionAudioEvent: audioEvents[1] || firstAudioEvent,
    nextQuestionFirstAudioMs: audioEvents.length
      ? Math.max(0, (audioEvents[1] || firstAudioEvent).at - speechEndEvent.at)
      : null,
  };
};

export const findTurnDoneAfterSpeechEnd = (events = [], speechEndEvent = null) => {
  if (!speechEndEvent) return null;
  const turnDoneEvent = events.find((event) => (
    event.direction === 'in'
    && event.type === 'turn_done'
    && event.at >= speechEndEvent.at
  ));
  return turnDoneEvent ? Math.max(0, turnDoneEvent.at - speechEndEvent.at) : null;
};

export const getLatencyStepMs = (latency = null, stepName = '') => {
  const step = latency?.steps?.find((item) => item?.step === stepName || item?.name === stepName);
  if (Number.isFinite(Number(step?.msFromStart))) return Number(step.msFromStart);
  return null;
};
