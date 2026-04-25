import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('keeps live captions hidden by default and lets the user expand them', async () => {
    const user = userEvent.setup();
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

    expect(screen.getByText('Live captions')).toBeInTheDocument();
    expect(screen.queryByText('ASR preview')).not.toBeInTheDocument();

    await user.click(screen.getByText('Live captions'));

    expect(screen.getByText('ASR preview')).toBeInTheDocument();
    expect(screen.getByText('partial answer')).toBeInTheDocument();
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

    expect(screen.getByLabelText('Start recording')).toBeDisabled();
  });

  it('shows transcript confirmation controls for final realtime transcript', () => {
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

    expect(screen.getByText('medium confidence')).toBeInTheDocument();
  });
});
