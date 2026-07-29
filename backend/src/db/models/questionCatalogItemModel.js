import mongoose from 'mongoose';

const QuestionCatalogItemSchema = new mongoose.Schema(
  {
    catalogQuestionId: { type: String, required: true, index: true },
    catalogVersion: { type: String, required: true, index: true },
    lifecycle: { type: String, enum: ['draft', 'approved', 'deprecated', 'disabled'], required: true, index: true },
    questionFamily: { type: String, required: true, index: true },
    questionType: { type: String, required: true },
    competency: { type: String, required: true },
    category: { type: String, default: 'technical' },
    targetLevels: { type: [String], default: [] },
    roleEligibility: { type: mongoose.Schema.Types.Mixed, default: {} },
    promptVariants: { type: [mongoose.Schema.Types.Mixed], default: [] },
    expectedSignals: { type: [String], default: [] },
    followUpPolicy: { type: [mongoose.Schema.Types.Mixed], default: [] },
    ambiguityPolicy: { type: mongoose.Schema.Types.Mixed, default: {} },
    selectionPolicy: { type: mongoose.Schema.Types.Mixed, default: {} },
    reportDimensions: { type: [String], default: [] },
    notEligibleExamples: { type: [String], default: [] },
    researchBasis: { type: mongoose.Schema.Types.Mixed, default: {} },
    humanReview: { type: mongoose.Schema.Types.Mixed, default: {} },
    seedSource: { type: String, default: '' },
    containsSensitiveData: { type: Boolean, default: false },
    accessScope: { type: String, default: 'global_catalog' },
  },
  { timestamps: true }
);

QuestionCatalogItemSchema.index({ catalogQuestionId: 1, catalogVersion: 1 }, { unique: true });
QuestionCatalogItemSchema.index({ lifecycle: 1, catalogVersion: 1, questionFamily: 1 });

export const QuestionCatalogItem = mongoose.models.QuestionCatalogItem || mongoose.model('QuestionCatalogItem', QuestionCatalogItemSchema);
