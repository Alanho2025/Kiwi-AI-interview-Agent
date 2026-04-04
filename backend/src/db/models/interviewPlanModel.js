import mongoose from 'mongoose';

const QuestionPoolItemSchema = new mongoose.Schema(
  {
    type: String,
    text: String,
    reason: String,
    priority: Number,
    basedOnSkills: [String],
  },
  { _id: false }
);

const InterviewPlanSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    settingsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    candidateName: { type: String, default: 'Candidate' },
    jobTitle: { type: String, default: '' },
    matchScore: { type: Number, default: 0 },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
    interviewFocus: { type: [String], default: [] },
    planPreview: { type: String, default: '' },
    strategy: { type: mongoose.Schema.Types.Mixed, default: {} },
    questionPool: { type: [QuestionPoolItemSchema], default: [] },
    fallbackRules: { type: mongoose.Schema.Types.Mixed, default: {} },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    containsSensitiveData: { type: Boolean, default: true },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const InterviewPlan = mongoose.models.InterviewPlan || mongoose.model('InterviewPlan', InterviewPlanSchema);
