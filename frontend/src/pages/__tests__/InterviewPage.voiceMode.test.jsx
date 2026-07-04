import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewPage } from '../InterviewPage.jsx';

const useInterviewSessionMock = vi.fn();
const useVoiceInterviewSessionMock = vi.fn();
const navigateMock = vi.fn();
let capturedHeaderProps = null;
let capturedVoicePanelProps = null;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({ sessionId: 'session-1' }),
}));

vi.mock('../../hooks/useInterviewSession.js', () => ({
  useInterviewSession: (args) => useInterviewSessionMock(args),
}));

vi.mock('../../hooks/useVoiceInterviewSession.js', () => ({
  useVoiceInterviewSession: (args) => useVoiceInterviewSessionMock(args),
}));

vi.mock('../../contexts/TourContext.jsx', () => ({
  useTour: () => ({
    startTour: vi.fn(),
    globalTourStep: null,
    advanceGlobalTour: vi.fn(),
  }),
}));

vi.mock('../../components/interview/InterviewChatPanel.jsx', () => ({
  InterviewChatPanel: () => <div data-testid="text-panel">Text interview panel</div>,
}));

vi.mock('../../components/interview/VoiceInterviewPanel.jsx', () => ({
  VoiceInterviewPanel: (props) => {
    capturedVoicePanelProps = props;
    return <div data-testid="voice-panel">Voice interview panel</div>;
  },
}));

vi.mock('../../components/interview/InterviewPageHeader.jsx', () => ({
  InterviewPageHeader: (props) => {
    capturedHeaderProps = props;
    return <header>Header</header>;
  },
}));

vi.mock('../../components/interview/InterviewRightRail.jsx', () => ({
  InterviewRightRail: () => <aside>Right rail</aside>,
}));

vi.mock('../../components/interview/InterviewSidebar.jsx', () => ({
  InterviewSidebar: () => <aside>Sidebar</aside>,
}));

vi.mock('../../components/interview/InterviewStatusBanner.jsx', () => ({
  InterviewStatusBanner: () => null,
}));

const baseResponse = {
  loading: false,
  isSubmitting: false,
  pageStatus: null,
  dismissStatus: vi.fn(),
  handleReply: vi.fn(),
  handleVoiceReply: vi.fn(),
  handlePauseToggle: vi.fn(),
  handleRepeat: vi.fn(),
  handleEnd: vi.fn(),
  handleConfirmEnd: vi.fn(),
  handleExport: vi.fn(),
  viewModel: {
    title: 'Mock interview',
    roleFamilyLabel: 'Software',
    exactRoleTitle: 'Developer',
    modeLabel: 'Text',
    levelLabel: 'Intern',
    stageLabel: 'Question 1',
    elapsedSeconds: 0,
  },
};

describe('InterviewPage voice/text mode separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHeaderProps = null;
    capturedVoicePanelProps = null;
    useVoiceInterviewSessionMock.mockReturnValue({
      currentQuestion: { text: 'Question' },
      canUseVoice: true,
    });
  });

  it('renders text panel for text sessions and keeps voice disabled', () => {
    useInterviewSessionMock.mockReturnValue({
      ...baseResponse,
      session: { id: 'session-1', status: 'in_progress', mode: 'text', transcript: [] },
    });

    render(<InterviewPage />);

    expect(screen.getByTestId('text-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-panel')).not.toBeInTheDocument();
    expect(useVoiceInterviewSessionMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('renders voice panel only for voice sessions', () => {
    useInterviewSessionMock.mockReturnValue({
      ...baseResponse,
      session: { id: 'session-1', status: 'in_progress', mode: 'voice', transcript: [] },
    });

    render(<InterviewPage />);

    expect(screen.getByTestId('voice-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('text-panel')).not.toBeInTheDocument();
    expect(useVoiceInterviewSessionMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('navigates after local recording durability without waiting for remote conversion', async () => {
    const finalizeLocalRecording = vi.fn().mockResolvedValue({ state: 'locally_durable' });
    const stopVoiceSession = vi.fn(() => new Promise(() => {}));
    useVoiceInterviewSessionMock.mockReturnValue({
      currentQuestion: { text: 'Question' },
      canUseVoice: false,
      finalizeLocalRecording,
      stopVoiceSession,
    });
    useInterviewSessionMock.mockReturnValue({
      ...baseResponse,
      session: { id: 'session-1', status: 'completed', mode: 'voice', transcript: [] },
    });

    render(<InterviewPage />);
    const reportAction = capturedHeaderProps.onViewReport();
    await Promise.resolve();
    await Promise.resolve();

    expect(finalizeLocalRecording).toHaveBeenCalledWith('view_report');
    expect(stopVoiceSession).toHaveBeenCalledWith('view_report');
    expect(navigateMock).toHaveBeenCalledWith('/report/session-1');
    void reportAction;
  });

  it('finalizes local recording before manually ending a voice interview', async () => {
    const finalizeLocalRecording = vi.fn().mockResolvedValue({ state: 'locally_durable' });
    const stopVoiceSession = vi.fn().mockResolvedValue(undefined);
    const handleEnd = vi.fn();
    useVoiceInterviewSessionMock.mockReturnValue({
      currentQuestion: { text: 'Question' },
      canUseVoice: true,
      finalizeLocalRecording,
      stopVoiceSession,
    });
    useInterviewSessionMock.mockReturnValue({
      ...baseResponse,
      handleEnd,
      session: { id: 'session-1', status: 'in_progress', mode: 'voice', transcript: [] },
    });

    render(<InterviewPage />);
    await capturedVoicePanelProps.onEnd();

    expect(finalizeLocalRecording).toHaveBeenCalledWith('manual_end');
    expect(stopVoiceSession).toHaveBeenCalledWith('manual_end');
    expect(finalizeLocalRecording).toHaveBeenCalledBefore(stopVoiceSession);
    expect(handleEnd).toHaveBeenCalledWith({ mode: 'voice' });
  });

  it('does not leave the page when the final recording chunk cannot be saved locally', async () => {
    const setPageStatus = vi.fn();
    useVoiceInterviewSessionMock.mockReturnValue({
      finalizeLocalRecording: vi.fn().mockRejectedValue(new Error('IndexedDB quota exceeded')),
      stopVoiceSession: vi.fn(),
    });
    useInterviewSessionMock.mockReturnValue({
      ...baseResponse,
      setPageStatus,
      session: { id: 'session-1', status: 'completed', mode: 'voice', transcript: [] },
    });

    render(<InterviewPage />);
    await capturedHeaderProps.onViewReport();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(setPageStatus).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      title: 'Recording not saved yet',
    }));
  });
});
