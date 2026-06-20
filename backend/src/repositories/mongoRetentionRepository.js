const groupCandidatesByCollection = (candidates = []) => {
  const grouped = new Map();
  for (const candidate of candidates) {
    const entries = grouped.get(candidate.collection) || [];
    entries.push(candidate);
    grouped.set(candidate.collection, entries);
  }
  return grouped;
};

const buildSnapshotFilter = (candidate) => ({
  _id: ObjectId.isValid(candidate.id) ? new ObjectId(candidate.id) : candidate.id,
  updatedAt: new Date(candidate.updatedAt),
});

export const createMongoRetentionRepository = ({ connection, modelsByCollection }) => ({
  deleteCandidatesInTransaction: async ({ candidates = [] } = {}) => {
    if (!candidates.length) return { deletedCount: 0, skippedCount: 0 };
    let deletedCount = 0;
    await connection.transaction(async (session) => {
      const grouped = groupCandidatesByCollection(candidates);
      for (const [collectionName, collectionCandidates] of grouped) {
        const model = modelsByCollection.get(collectionName);
        if (!model) throw new Error(`Unsupported Mongo retention collection: ${collectionName}`);
        const result = await model.deleteMany(
          { $or: collectionCandidates.map(buildSnapshotFilter) },
          { session },
        );
        deletedCount += Number(result.deletedCount || 0);
      }
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
    return { deletedCount, skippedCount: candidates.length - deletedCount };
  },
});
import { ObjectId } from 'mongodb';
