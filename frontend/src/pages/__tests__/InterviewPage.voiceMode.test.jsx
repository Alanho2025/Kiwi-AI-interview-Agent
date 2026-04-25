import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewPage } from '../InterviewPage.jsx';

const useInterviewSessionMock = vi.fn();
const useVoiceInterviewSessionMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ sessionId: 'session-1' }),
}));

vi.mock('../../hooks/useInterviewSession.js', () => ({
  useInterviewSession: (args) => useInterviewSessionMock(args),
}));

vi.mock('../../hooks/useVoiceInterviewSession.js', () => ({
  useVoiceInterviewSession: (args) => useVoiceInterviewSessionMock(args),
}));

vi.mock('../../components/interview/InterviewChatPanel.jsx', () => ({
  InterviewChatPanel: () => <div data-testid="text-panel">Text interview panel</div>,
}));

vi.mock('../../components/interview/VoiceInterviewPanel.jsx', () => ({
  VoiceInterviewPanel: () => <div data-testid="voice-panel">Voice interview panel</div>,
}));

vi.mock('../../components/interview/InterviewPageHeader.jsx', () => ({
  InterviewPageHeader: () => <header>Header</header>,
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
    window.speechSynthesis.speak = vi.fn();
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
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
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
});
