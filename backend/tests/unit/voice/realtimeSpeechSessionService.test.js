import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pushStream, getRecognizerInstance, MockRecognizer } = vi.hoisted(() => {
      const state = {
        pushStream: {
          write: vi.fn(),
          close: vi.fn(),
        },
        recognizerInstance: null,
      };

      class MockRecognizer {
        constructor() {
          this.startContinuousRecognitionAsync = vi.fn((resolve) => resolve());
          this.stopContinuousRecognitionAsync = vi.fn((resolve) => resolve());
          this.close = vi.fn();
          state.recognizerInstance = this;
        }
      }

      return {
        pushStream: state.pushStream,
        getRecognizerInstance: () => state.recognizerInstance,
        MockRecognizer,
      };
    });

    vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: {
    fromSubscription: vi.fn(() => ({
      setProperty: vi.fn(),
      speechRecognitionLanguage: '',
    })),
  },
  AudioStreamFormat: {
    getWaveFormatPCM: vi.fn(() => ({ sampleRate: 16000 })),
  },
  AudioInputStream: {
    createPushStream: vi.fn(() => pushStream),
  },
  AudioConfig: {
    fromStreamInput: vi.fn(() => ({ stream: pushStream })),
  },
  SpeechRecognizer: MockRecognizer,
  PhraseListGrammar: {
    fromRecognizer: vi.fn(() => ({ addPhrase: vi.fn() })),
  },
  PropertyId: {
    SpeechServiceResponse_RequestWordLevelTimestamps: 'word-timestamps',
    SpeechServiceResponse_PostProcessingOption: 'post-processing',
    SpeechServiceResponse_JsonResult: 'json-result',
  },
  ResultReason: {
    RecognizedSpeech: 'RecognizedSpeech',
  },
}));

describe('createRealtimeSpeechSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AZURE_SPEECH_KEY = 'key';
    process.env.AZURE_SPEECH_REGION = 'australiaeast';
  });

  it('requires Azure Speech credentials', async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const { createRealtimeSpeechSession } = await import('../../../src/services/voice/realtimeSpeechSessionService.js');

    expect(() => createRealtimeSpeechSession()).toThrow('Azure Speech credentials are missing');
  });

  it('starts, writes audio, emits transcripts, and stops cleanly', async () => {
    const onPartialTranscript = vi.fn();
    const onFinalTranscript = vi.fn();
    const { createRealtimeSpeechSession } = await import('../../../src/services/voice/realtimeSpeechSessionService.js');

    const session = createRealtimeSpeechSession({
      language: 'en-NZ',
      onPartialTranscript,
      onFinalTranscript,
    });

    await session.start();
    session.writeAudio(Buffer.from([1, 2, 3]));

    expect(pushStream.write).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));

    getRecognizerInstance().recognizing(null, { result: { text: 'react query' } });
    expect(onPartialTranscript).toHaveBeenCalledWith(expect.objectContaining({
      type: 'partial_transcript',
      text: 'react query',
      language: 'en-NZ',
    }));

    getRecognizerInstance().recognized(null, {
      result: {
        reason: 'RecognizedSpeech',
        text: 'react query',
        properties: {
          getProperty: () => JSON.stringify({ NBest: [{ Confidence: 0.88 }] }),
        },
      },
    });

    expect(onFinalTranscript).toHaveBeenCalledWith(expect.objectContaining({
      type: 'final_transcript',
      displayText: 'React Query',
      confidence: 0.88,
      confidenceStatus: 'high',
    }));

    await session.stop();
    expect(pushStream.close).toHaveBeenCalled();
    expect(getRecognizerInstance().close).toHaveBeenCalled();
  });
});
