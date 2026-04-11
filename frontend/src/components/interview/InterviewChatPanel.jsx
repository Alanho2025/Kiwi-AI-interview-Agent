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
import { Bird, Send } from 'lucide-react';
import { cn } from '../../utils/formatters.js';

/**
 * Purpose: Execute the main responsibility for InterviewChatPanel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function InterviewChatPanel({ transcript, onReply, onPause, onRepeat, onEnd, isPaused, isCompleted, isSubmitting, candidateName = "Candidate" }) {
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

  const currentQuestion = transcript.filter(m => m.role === 'ai').pop();
  
  // The chat history should show everything except the current question if it's the last message
  const isLastMessageAi = transcript.length > 0 && transcript[transcript.length - 1].role === 'ai';
  const historyTranscript = isLastMessageAi ? transcript.slice(0, -1) : transcript;

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-gray-200 shadow-sm">
        {/* Chat History Area */}
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 min-h-0">
          {historyTranscript.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-4 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                msg.role === 'ai' ? "bg-[#e6f7f0] text-[#2eb886]" : "bg-gray-200 text-gray-600"
              )}>
                {msg.role === 'ai' ? <Bird className="w-5 h-5" /> : <span className="text-sm font-medium">{initials}</span>}
              </div>
              <div className={cn(
                "p-4 rounded-2xl text-sm shadow-sm",
                msg.role === 'ai' ? "bg-white text-gray-900 rounded-tl-none border border-gray-100" : "bg-[#2eb886] text-white rounded-tr-none"
              )}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Current Question Highlight */}
        <div className={cn(
          "border-t p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 transition-colors shrink-0",
          isPaused ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"
        )}>
          {isPaused ? (
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-lg font-semibold text-amber-700 mb-2">Interview Paused</p>
              <p className="text-sm text-amber-600">Click Resume to continue your interview.</p>
            </div>
          ) : isCompleted ? (
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-lg font-semibold text-emerald-700 mb-2">Interview Completed</p>
              <p className="text-sm text-emerald-600">The planned questions are finished. You can review the report now.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                {(!isLastMessageAi || isSubmitting) ? 'Aroha is thinking...' : 'Current Question'}
              </p>
              {(!isLastMessageAi || isSubmitting) ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : (
                <p className="text-lg font-medium text-gray-900">{currentQuestion?.text}</p>
              )}
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          <div className="relative">
            <TextArea 
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isCompleted ? "Interview completed" : (isPaused ? "Interview paused..." : (isSubmitting ? "Aroha is thinking..." : "Type your answer here..."))}
              rows={3}
              className="pr-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isPaused || isCompleted || isSubmitting}
            />
            <button 
              onClick={handleSend}
              disabled={!draft.trim() || isPaused || isCompleted || isSubmitting}
              className="absolute bottom-3 right-3 p-2 bg-[#2eb886] text-white rounded-lg hover:bg-[#259a6f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center justify-between px-2 shrink-0">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onPause} disabled={isCompleted}>
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="secondary" onClick={onRepeat} disabled={isPaused || isCompleted || isSubmitting}>
            Repeat Question
          </Button>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" onClick={onEnd} disabled={isSubmitting || isCompleted}>End Interview</Button>
        </div>
      </div>
    </div>
  );
}
