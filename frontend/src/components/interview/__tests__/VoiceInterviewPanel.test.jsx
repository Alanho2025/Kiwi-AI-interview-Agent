import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceInterviewPanel } from '../VoiceInterviewPanel.jsx';

const buildVoiceShell = (overrides = {}) => ({
  currentQuestion: { text: 'Tell me about a time you solved a difficult technical problem with limited information.'.repeat(3) },
  permissionState: 'granted',
  permissionError: '',
  stateLabel: 'Realtime captions ready',
  voiceStatus: null,
  voiceMode: 'realtime',
  setVoiceMode: vi.fn(),
  realtimeStatus: 'ready',
  pendingTranscript: null,
  editableTranscript: '',
  setEditableTranscript: vi.fn(),
  isRecording: false,
  isProcessingTurn: false,
  canUseVoice: true,
  levelHistory: [0.2, 0.5, 0.9],
  recordingDurationLabel: '00:12',
  transcriptionPreview: '',
  assistantAudioUrl: '',
  audioRef: { current: null },
  lastAsrConfidence: null,
  manualAudioFile: null,
  handleRequestPermission: vi.fn(),
  handleToggleRecording: vi.fn(),
  handleUseRealtimeTranscript: vi.fn(),
  handleRecordAgain: vi.fn(),
  handleReplayAssistantAudio: vi.fn(() => false),
  handleResetShell: vi.fn(),
  handleAudioFileSelect: vi.fn(),
  handleSubmitSelectedAudio: vi.fn(),
  ...overrides,
});

describe('VoiceInterviewPanel', () => {
  it('does not render the removed live captions debug panel', () => {
    render(
      <VoiceInterviewPanel
        isPaused={false}
        isCompleted={false}
        isSubmitting={false}
        onPause={vi.fn()}
        onRepeat={vi.fn()}
        onEnd={vi.fn()}
        voiceShell={buildVoiceShell({ transcriptionPreview: 'partial answer' })}
      />
    );

    expect(screen.queryByText('Live captions')).not.toBeInTheDocument();
    expect(screen.queryByText('ASR preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Auto-submitted transcript')).not.toBeInTheDocument();
    expect(screen.queryByText('WAITING FOR FINAL TRANSCRIPT')).not.toBeInTheDocument();
  });

  it('disables microphone action when voice cannot be used', () => {
    const voiceShell = buildVoiceShell({ canUseVoice: false });
    render(
      <VoiceInterviewPanel
        isPaused={false}
        isCompleted={false}
        isSubmitting={false}
        onPause={vi.fn()}
        onRepeat={vi.fn()}
        onEnd={vi.fn()}
        voiceShell={voiceShell}
      />
    );

    expect(screen.getByLabelText('Start voice interview')).toBeDisabled();
  });

  it('keeps final transcript debug text out of the voice panel', () => {
    render(
      <VoiceInterviewPanel
        isPaused={false}
        isCompleted={false}
        isSubmitting={false}
        onPause={vi.fn()}
        onRepeat={vi.fn()}
        onEnd={vi.fn()}
        voiceShell={buildVoiceShell({
          pendingTranscript: { displayText: 'My confirmed answer', confidenceStatus: 'medium' },
          editableTranscript: 'My confirmed answer',
        })}
      />
    );

    expect(screen.queryByText('medium confidence')).not.toBeInTheDocument();
    expect(screen.queryByText('My confirmed answer')).not.toBeInTheDocument();
  });
});
