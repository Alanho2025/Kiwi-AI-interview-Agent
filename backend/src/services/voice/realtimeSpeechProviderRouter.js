import { createRealtimeSpeechSession } from './realtimeSpeechSessionService.js';
import { createElevenLabsRealtimeSpeechSession } from './elevenLabsRealtimeSpeechSessionService.js';

const providerFactories = {
  azure: createRealtimeSpeechSession,
  elevenlabs: createElevenLabsRealtimeSpeechSession,
  elevenlabs_realtime: createElevenLabsRealtimeSpeechSession,
};

const normalizeProviderName = (value) => String(value || '').trim().toLowerCase().replace(/-/g, '_');

const getProviderOrder = () => {
  const configuredOrder = String(process.env.VOICE_STT_PROVIDER_ORDER || '').trim();
  if (configuredOrder) {
    return configuredOrder.split(',').map(normalizeProviderName).filter(Boolean);
  }
  const primary = normalizeProviderName(process.env.VOICE_STT_PROVIDER || 'azure');
  const fallback = normalizeProviderName(process.env.VOICE_STT_FALLBACK_PROVIDER || 'elevenlabs');
  return Array.from(new Set([primary, fallback].filter(Boolean)));
};

const createProviderSession = (providerName, options) => {
  const factory = providerFactories[providerName];
  if (!factory) throw new Error(`${providerName}: unsupported realtime STT provider`);
  return factory(options);
};

const emitProviderSelected = ({ providerName, fallbackFrom, onSessionStarted }) => {
  onSessionStarted?.({
    type: 'speech_provider_selected',
    provider: providerName,
    fallbackFrom: fallbackFrom || null,
    timestamp: new Date().toISOString(),
  });
};

export const createRoutedRealtimeSpeechSession = (options = {}) => {
  const providerOrder = getProviderOrder();
  const errors = [];
  let selectedProviderName = null;
  let selectedSession = null;

  for (const providerName of providerOrder) {
    try {
      selectedSession = createProviderSession(providerName, options);
      selectedProviderName = providerName;
      break;
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  if (!selectedSession) {
    throw new Error(`No realtime STT provider could be created. ${errors.join('; ')}`);
  }

  const startFallback = async (startError) => {
    const currentIndex = providerOrder.indexOf(selectedProviderName);
    for (const fallbackName of providerOrder.slice(currentIndex + 1)) {
      try {
        options.onError?.({
          type: 'speech_error',
          reason: 'provider_start_failed_fallback_attempted',
          provider: selectedProviderName,
          errorDetails: startError?.message || String(startError),
          timestamp: new Date().toISOString(),
        });
        const previousProvider = selectedProviderName;
        selectedSession = createProviderSession(fallbackName, options);
        selectedProviderName = fallbackName;
        await selectedSession.start();
        emitProviderSelected({ providerName: fallbackName, fallbackFrom: previousProvider, onSessionStarted: options.onSessionStarted });
        return;
      } catch (fallbackError) {
        errors.push(fallbackError?.message || String(fallbackError));
      }
    }
    throw startError;
  };

  return {
    get providerName() {
      return selectedProviderName;
    },
    start: async () => {
      try {
        await selectedSession.start();
        emitProviderSelected({ providerName: selectedProviderName, fallbackFrom: providerOrder[0] !== selectedProviderName ? providerOrder[0] : null, onSessionStarted: options.onSessionStarted });
      } catch (error) {
        await startFallback(error);
      }
    },
    writeAudio: (chunk) => selectedSession.writeAudio(chunk),
    stop: () => selectedSession.stop(),
  };
};
