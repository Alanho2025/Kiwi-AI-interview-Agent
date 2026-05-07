import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceInterviewPanel } from '../VoiceInterviewPanel.jsx';

const buildVoiceShell = (overrides = {}) => ({
  currentQuestion: { text: 'Tell me about a time you solved a difficult technical problem with limited information.'.repeat(3) },
  permissionState: 'granted',
  permissionError: '',
  stateLabel: 'Realtime captions ready',
  voiceState: 'ready',
  voiceStatus: null,
  voiceMode: 'realtime',
  setVoiceMode: vi.fn(),
  realtimeStatus: 'ready',
  pendingTranscript: null,
  editableTranscript: '',
  setEditableTranscript: vi.fn(),
  isRecording: false,
  isProcessingTurn: false,
  isVoiceTakingLong: false,
  voiceNetworkQuality: { status: 'good', title: 'Voice connection steady', message: 'Realtime voice responses are within the expected range.' },
  canUseVoice: true,
  levelHistory: [0.2, 0.5, 0.9],
  recordingDurationLabel: '00:12',
  transcriptionPreview: '',
  assistantAudioUrl: '',
  audioRef: { current: null },
  lastAsrConfidence: null,
  lastTranscriptRejection: null,
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

  it('shows scoring boundary wording without requiring transcript confirmation', () => {
    render(
      <VoiceInterviewPanel
        isPaused={false}
        isCompleted={false}
        isSubmitting={false}
        onPause={vi.fn()}
        onRepeat={vi.fn()}
        onEnd={vi.fn()}
        voiceShell={buildVoiceShell()}
      />
    );

    expect(screen.getByText(/scores answer content and communication clarity/i)).toBeInTheDocument();
    expect(screen.queryByText('Confirm answer')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit transcript')).not.toBeInTheDocument();
  });

  it('offers recovery actions when speech recognition is unclear', () => {
    const onSubmitBackup = vi.fn();
    const handleResetShell = vi.fn();

    render(
      <VoiceInterviewPanel
        isPaused={false}
        isCompleted={false}
        isSubmitting={false}
        onPause={vi.fn()}
        onRepeat={vi.fn()}
        onEnd={vi.fn()}
        onSubmitBackup={onSubmitBackup}
        voiceShell={buildVoiceShell({
          lastTranscriptRejection: {
            message: 'Voice recognition was not confident it heard that correctly.',
          },
          handleResetShell,
        })}
      />
    );

    expect(screen.getByText('Voice did not catch that clearly')).toBeInTheDocument();
    expect(screen.getByText('Retry voice')).toBeInTheDocument();
    expect(screen.getByText('Answer by text')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Answer by text'));
    fireEvent.change(screen.getByPlaceholderText('Type the answer you would give for this question...'), {
      target: { value: 'I used SQL to clean the dataset and checked the result with tests.' },
    });
    fireEvent.click(screen.getByText('Submit text answer'));

    expect(handleResetShell).toHaveBeenCalled();
    expect(onSubmitBackup).toHaveBeenCalledWith('I used SQL to clean the dataset and checked the result with tests.');
  });

  it('shows runtime connection guidance during a slow voice session', () => {
    render(
      <VoiceInterviewPanel
        isPaused={false}
        isCompleted={false}
        isSubmitting={false}
        onPause={vi.fn()}
        onRepeat={vi.fn()}
        onEnd={vi.fn()}
        voiceShell={buildVoiceShell({
          isAutoLoopActive: true,
          voiceNetworkQuality: {
            status: 'poor',
            title: 'Connection is slowing voice responses',
            message: 'KiwiCoach may take longer to reply. Keep answers concise, or switch to text for this question if the delay continues.',
            rttMs: 520,
          },
        })}
      />
    );

    expect(screen.getByText('Connection is slowing voice responses')).toBeInTheDocument();
    expect(screen.getByText('520ms')).toBeInTheDocument();
  });
});
