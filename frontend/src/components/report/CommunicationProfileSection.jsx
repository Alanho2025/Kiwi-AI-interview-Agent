import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

export function CommunicationProfileSection({ profile }) {
  if (!profile || (!profile.summary && (!profile.keyTraits || profile.keyTraits.length === 0))) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Style Profile</CardTitle>
        <p className="text-sm text-gray-500 mt-1">An analysis of your personal communication patterns and delivery.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary */}
          {profile.summary && (
            <div className="rounded-xl bg-indigo-50/50 p-5 border border-indigo-100/50">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-indigo-700 mb-2">Overall Impression</h4>
              <p className="text-sm leading-relaxed text-indigo-900">{profile.summary}</p>
            </div>
          )}

          {/* Traits Grid */}
          {profile.keyTraits && profile.keyTraits.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-1">Key Traits</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {profile.keyTraits.map((trait, index) => (
                  <div key={index} className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                      <h5 className="text-sm font-semibold text-gray-900">{trait.label}</h5>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{trait.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filler Words */}
          {profile.fillerWords && (
            <div className="rounded-xl bg-rose-50/50 p-5 border border-rose-100/50">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-rose-700 mb-2">Delivery & Filler Words</h4>
              <p className="text-sm leading-relaxed text-rose-900">{profile.fillerWords}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
