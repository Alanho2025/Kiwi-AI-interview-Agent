import { Card, CardContent } from '../common/Card.jsx';

export function SessionInfoCard({ totalQuestions, seniorityLevel }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Session Info</h3>
          <p className="text-sm text-gray-600">Total Questions: {totalQuestions || 8}</p>
          <p className="text-sm text-gray-600 mt-1">Level: {seniorityLevel || 'General'}</p>
        </div>
        
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Next steps</h3>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Immediate text feedback</li>
            <li>• Submit session to review</li>
            <li>• Export transcript (.txt)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
