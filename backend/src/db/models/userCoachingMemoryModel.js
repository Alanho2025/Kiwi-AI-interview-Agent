import mongoose from 'mongoose';

const UserCoachingMemorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    memoryRecords: { type: [mongoose.Schema.Types.Mixed], default: [] },
    latestSummary: { type: String, default: '' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const UserCoachingMemory = mongoose.models.UserCoachingMemory || mongoose.model('UserCoachingMemory', UserCoachingMemorySchema);
