/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InterviewChatPanel should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { TextArea } from '../common/TextArea.jsx';
import { Bird, CirclePause, Play, RefreshCcw, Send, Square } from 'lucide-react';
import { cn } from '../../utils/formatters.js';

const INTERVIEWER_NAME = 'Kiwi Coach';

/**
 * Purpose: Execute the main responsibility for InterviewChatPanel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function InterviewChatPanel({ transcript, onStart, onReply, onPause, onRepeat, onEnd, isPaused, isCompleted, isSubmitting, candidateName = "Candidate", sessionStatus = 'ready' }) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

  const initials = candidateName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcript, isSubmitting]);

  const handleSend = () => {
    if (draft.trim() && !isSubmitting && !isPaused && !isCompleted) {
      onReply(draft);
      setDraft('');
    }
  };

  const isNotStarted = sessionStatus === 'ready';
  const currentQuestion = transcript.filter(m => m.role === 'ai').pop();
  
  // The chat history should show everything except the current question if it's the last message
  const isLastMessageAi = transcript.length > 0 && transcript[transcript.length - 1].role === 'ai';
  const historyTranscript = isLastMessageAi ? transcript.slice(0, -1) : transcript;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-theme shadow-sm">
        {/* Chat History Area */}
        <CardContent className="max-h-[300px] flex-1 overflow-y-auto space-y-4 bg-transparent p-4 sm:max-h-none sm:space-y-6 sm:p-6 lg:min-h-0">
          {historyTranscript.map((msg, idx) => (
            <div key={idx} className={cn("flex max-w-[92%] gap-3 sm:max-w-[85%] sm:gap-4", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 sm:h-10 sm:w-10",
                msg.role === 'ai' ? "[background:var(--accent-glow)] text-accent" : "bg-chip text-muted"
              )}>
                {msg.role === 'ai' ? <Bird className="w-5 h-5" /> : <span className="text-sm font-medium">{initials}</span>}
              </div>
              <div className={cn(
                "break-words p-3 sm:p-4 rounded-2xl text-sm shadow-sm whitespace-pre-line",
                msg.role === 'ai' ? "glass text-primary rounded-tl-none border border-gray-100" : "[background:var(--accent)] text-primary rounded-tr-none"
              )}>
                {msg.displayText || msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Current Question Highlight */}
        <div className={cn(
          "border-t p-4 sm:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 transition-colors shrink-0",
          isPaused ? "bg-amber-50 border-amber-200" : "glass border-gray-100"
        )}>
          {isPaused ? (
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-lg font-semibold text-amber-700 mb-2">Interview paused</p>
              <p className="text-sm text-amber-600">Click Resume when you are ready to continue.</p>
            </div>
          ) : isCompleted ? (
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-lg font-semibold text-emerald-700 mb-2">Interview completed</p>
              <p className="text-sm text-emerald-600">Review your report to see feedback and next steps.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-faint mb-2 uppercase tracking-wider">
                {isNotStarted ? 'Ready to start' : ((!isLastMessageAi || isSubmitting) ? `${INTERVIEWER_NAME} is preparing the next question...` : 'Current question')}
              </p>
              {isNotStarted ? (
                <div className="space-y-3">
                  <p className="text-base font-medium text-primary sm:text-lg">Start when you are ready. The timer begins after the first question loads.</p>
              <Button type="button" onClick={onStart} disabled={isSubmitting}>
                <Play className="mr-2 h-4 w-4" />
                Start text interview
              </Button>
                </div>
              ) : (!isLastMessageAi || isSubmitting) ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : (
                <p className="whitespace-pre-line break-words text-base font-medium text-primary sm:text-lg">{currentQuestion?.displayText || currentQuestion?.text}</p>
              )}
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 z-20 shrink-0 border-t border-theme glass p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] lg:static lg:shadow-none">
          <div className="relative">
            <TextArea 
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isCompleted ? "Interview completed" : (isNotStarted ? "Start the interview first..." : (isPaused ? "Interview paused..." : (isSubmitting ? `${INTERVIEWER_NAME} is preparing the next question...` : "Type your answer here...")))}
              rows={3}
              className="pr-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isNotStarted || isPaused || isCompleted || isSubmitting}
            />
            <button 
              onClick={handleSend}
              disabled={!draft.trim() || isNotStarted || isPaused || isCompleted || isSubmitting}
              className="absolute bottom-3 right-3 p-2 [background:var(--accent)] text-primary rounded-lg hover:[background:var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Action Bar */}
      <div className="grid shrink-0 grid-cols-3 gap-2 px-2">
        <Button variant="secondary" className="px-3" onClick={onPause} disabled={isNotStarted || isCompleted}>
          <CirclePause className="h-4 w-4" />
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="secondary" className="px-3" onClick={onRepeat} disabled={isNotStarted || isPaused || isCompleted || isSubmitting}>
          <RefreshCcw className="h-4 w-4" />
          Ask again
        </Button>
        <Button variant="danger" className="px-3" onClick={onEnd} disabled={isSubmitting || isCompleted}>
          <Square className="h-4 w-4" />
          End
        </Button>
      </div>
    </div>
  );
}
