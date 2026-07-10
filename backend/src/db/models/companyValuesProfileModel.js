import mongoose from 'mongoose';

const CompanyValueSchema = new mongoose.Schema(
  {
    id: String,
    label: String,
    description: String,
    sourceUrl: String,
    confidence: Number,
  },
  { _id: false }
);

const SearchResultSchema = new mongoose.Schema(
  {
    title: String,
    url: String,
    snippet: String,
    score: Number,
    rejectedReason: String,
  },
  { _id: false }
);

const FetchedPageSchema = new mongoose.Schema(
  {
    url: String,
    title: String,
    textPreview: String,
    status: String,
    errorMessage: String,
  },
  { _id: false }
);

const CompanyValuesProfileSchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true, default: null },
    jdFingerprint: { type: String, index: true, required: true },
    userId: { type: String, index: true, required: true },

    companyName: String,
    location: String,
    websiteUrl: String,
    manualWebsiteUrl: String,

    status: {
      type: String,
      enum: ['not_started', 'pending', 'searching', 'fetching', 'extracting', 'ready', 'fallback', 'failed'],
      default: 'not_started',
      index: true,
    },

    source: {
      type: String,
      enum: ['serper', 'official_website', 'jd_text', 'general_fallback', 'manual', 'unknown'],
      default: 'unknown',
    },

    confidence: { type: Number, default: 0 },
    values: [CompanyValueSchema],
    mission: String,
    cultureNotes: [String],

    roleFitProfile: { type: mongoose.Schema.Types.Mixed, default: null },
    roleFitReviewVersion: { type: Number, default: 0 },
    roleFitReviewStatus: {
      type: String,
      enum: ['unreviewed', 'edited', 'verified'],
      default: 'unreviewed',
    },
    roleFitReviewedAt: Date,

    searchQueries: [String],
    searchResults: [SearchResultSchema],
    fetchedPages: [FetchedPageSchema],

    fallbackReason: String,
    errorMessage: String,

    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

CompanyValuesProfileSchema.index({ userId: 1, jdFingerprint: 1 }, { unique: true });
CompanyValuesProfileSchema.index({ sessionId: 1 }, { sparse: true });

export const CompanyValuesProfile =
  mongoose.models.CompanyValuesProfile ||
  mongoose.model('CompanyValuesProfile', CompanyValuesProfileSchema);
