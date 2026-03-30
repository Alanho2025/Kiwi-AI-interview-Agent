import { useState } from 'react';
import { Card, CardContent } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { TextArea } from '../common/TextArea.jsx';

export function TextBackupCard({ onSubmit, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');

  return (
    <Card>
      <div className="p-5 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Text Draft</h3>
          <p className="text-xs text-gray-500">Use this area to draft or save backup text</p>
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
