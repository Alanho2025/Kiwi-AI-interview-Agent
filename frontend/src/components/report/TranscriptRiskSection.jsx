import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

export function TranscriptRiskSection({ risks = [] }) {
  if (!risks.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript Checks Needed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {risks.map((risk, index) => (
            <div key={`${risk.code}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-950">{risk.message}</p>
              <p className="mt-2 text-xs text-amber-800">
                Affected: {(risk.affectedTurnIds || []).join(', ') || 'interview transcript'}. Review the transcript before relying on this claim.
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

