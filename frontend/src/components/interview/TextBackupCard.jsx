/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: TextBackupCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useState } from 'react';
import { Card, CardContent } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { TextArea } from '../common/TextArea.jsx';

/**
 * Purpose: Execute the main responsibility for TextBackupCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function TextBackupCard({ onSubmit, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');

  return (
    <Card>
      <div className="flex cursor-pointer items-start justify-between gap-3 p-5" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 className="text-sm font-semibold text-primary">Text Reply</h3>
          <p className="mt-1 text-xs leading-5 text-faint">Use this only when voice input is unavailable or you need to submit a backup answer.</p>
        </div>
        <Button variant="secondary" size="sm">
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>
      
      {expanded && (
        <CardContent className="p-5 pt-0 space-y-4">
          <TextArea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Draft your response here..."
            rows={3}
            disabled={disabled}
          />
          <div className="flex justify-end">
            <Button 
              variant="primary" 
              onClick={() => {
                onSubmit(text);
                setText('');
              }}
              disabled={!text.trim() || disabled}
            >
              Submit Text
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
