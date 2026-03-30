import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { TextArea } from '../common/TextArea.jsx';
import { Button } from '../common/Button.jsx';
import { Loader2, UploadCloud } from 'lucide-react';

const SummarySection = ({ title, items = [] }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-4">
    <h5 className="text-sm font-semibold text-gray-900">{title}</h5>
    {items.length > 0 ? (
      <ul className="mt-3 space-y-2 text-sm text-gray-600">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2eb886]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-gray-500">No clear items detected in this section.</p>
    )}
  </div>
);

export function JobContextCard({ rawJD, setRawJD, structuredJD, structuredJDRubric, onSummarize, isSummarizing }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Job Context</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Paste the job description so AI can tailor interview questions and coaching tips.</p>
        </div>
        <div className="text-xs text-gray-400">NZ-focused analysis</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Paste Job Description (JD)</h4>
          <TextArea 
            rows={structuredJD ? 6 : 12} 
            placeholder="Copy the job requirements from SEEK or LinkedIn here..."
            value={rawJD}
            onChange={(e) => setRawJD(e.target.value)}
            maxLength={6000}
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">Tip: include responsibilities, tech stack, and must-have skills.</p>
            <p className="text-xs text-gray-400">{rawJD.length}/6000</p>
          </div>
        </div>

        <Button 
          variant="secondary" 
          onClick={onSummarize} 
          disabled={!rawJD.trim() || isSummarizing}
          className="w-full flex items-center justify-center gap-2"
        >
          {isSummarizing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Summarizing...</>
          ) : (
            <><UploadCloud className="w-4 h-4" /> Upload & Summarize JD</>
          )}
        </Button>

        {structuredJD && structuredJDRubric && (
          <div className="mt-4 space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">JD Summary</h4>
              <p className="mt-1 text-xs text-gray-500">
                This is the first structured pass of the raw JD. The same rubric is stored and reused for match scoring and interview question generation.
              </p>
            </div>

            <div className="rounded-lg border border-gray-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Job Title</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{structuredJDRubric.title}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SummarySection title="What This Job Does" items={structuredJDRubric.roleSummary} />
              <SummarySection title="Qualifications" items={structuredJDRubric.qualifications} />
              <SummarySection
                title="Related Skill Requirements"
                items={[
                  ...(structuredJDRubric.technicalSkillRequirements?.length
                    ? [`Technical: ${structuredJDRubric.technicalSkillRequirements.join(', ')}`]
                    : []),
                  ...(structuredJDRubric.softSkillRequirements?.length
                    ? [`Soft: ${structuredJDRubric.softSkillRequirements.join(', ')}`]
                    : []),
                ]}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
