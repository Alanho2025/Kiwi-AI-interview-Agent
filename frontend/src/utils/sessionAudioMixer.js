/**
 * File responsibility: Web Audio API mixer for dual-track session recording.
 * Main responsibilities:
 * - Combine candidate microphone stream and assistant audio playback into a single MediaStream.
 * - Provide independent gain controls for candidate and assistant audio.
 * - Support immediate muting of assistant audio on barge-in / user interruption.
 * - Fall back cleanly to mic-only stream if Web Audio mixing is unavailable.
 */

const noop = () => {};

export const createSessionAudioMixer = ({
  micStream,
  assistantAudioElement = null,
  AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null,
} = {}) => {
  if (!micStream) {
    throw new Error('Microphone stream is required for session audio mixer');
  }

  if (!AudioContextClass || typeof AudioContextClass !== 'function') {
    return {
      mixedStream: micStream,
      topology: 'mic_only',
      muteAssistant: noop,
      unmuteAssistant: noop,
      setAssistantGain: noop,
      cleanup: noop,
    };
  }

  try {
    const audioContext = new AudioContextClass();

    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(noop);
    }

    const destinationNode = audioContext.createMediaStreamDestination();
    const micSourceNode = audioContext.createMediaStreamSource(micStream);
    const micGainNode = audioContext.createGain();
    micGainNode.gain.value = 1.0;
    micSourceNode.connect(micGainNode);
    micGainNode.connect(destinationNode);

    let assistantGainNode = null;
    let topology = 'mic_only';

    if (assistantAudioElement && typeof audioContext.createMediaElementSource === 'function') {
      try {
        if (!assistantAudioElement.__sessionAudioMixerSourceNode) {
          assistantAudioElement.__sessionAudioMixerSourceNode = audioContext.createMediaElementSource(assistantAudioElement);
        }
        const assistantSourceNode = assistantAudioElement.__sessionAudioMixerSourceNode;
        assistantGainNode = audioContext.createGain();
        assistantGainNode.gain.value = 0.8;

        assistantSourceNode.connect(assistantGainNode);
        assistantGainNode.connect(destinationNode);
        assistantSourceNode.connect(audioContext.destination);

        topology = 'mixed';
      } catch {
        topology = 'mic_only';
      }
    }

    return {
      mixedStream: destinationNode.stream || micStream,
      topology,
      muteAssistant: () => {
        if (assistantGainNode && audioContext) {
          try { assistantGainNode.gain.setValueAtTime(0, audioContext.currentTime); } catch {}
        }
      },
      unmuteAssistant: (level = 0.8) => {
        if (assistantGainNode && audioContext) {
          try { assistantGainNode.gain.setValueAtTime(level, audioContext.currentTime); } catch {}
        }
      },
      setAssistantGain: (level) => {
        if (assistantGainNode && audioContext) {
          try {
            const validLevel = Math.max(0, Math.min(2, Number(level) || 0));
            assistantGainNode.gain.setValueAtTime(validLevel, audioContext.currentTime);
          } catch {}
        }
      },
      cleanup: () => {
        try {
          micSourceNode.disconnect();
          micGainNode.disconnect();
          if (assistantGainNode) assistantGainNode.disconnect();
          if (audioContext.state !== 'closed') {
            void audioContext.close().catch(noop);
          }
        } catch {}
      },
    };
  } catch {
    return {
      mixedStream: micStream,
      topology: 'mic_only',
      muteAssistant: noop,
      unmuteAssistant: noop,
      setAssistantGain: noop,
      cleanup: noop,
    };
  }
};
