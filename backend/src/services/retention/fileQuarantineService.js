import fs from 'fs/promises';
import path from 'path';

const assertInsideRoot = (targetPath, rootPath, label) => {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`File path resolves outside ${label}`);
  }
  return resolvedTarget;
};

const moveFile = async (sourcePath, destinationPath) => {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.rename(sourcePath, destinationPath);
};

export const createFileQuarantineService = ({ uploadsRoot, quarantineRoot }) => {
  const resolvedUploadsRoot = path.resolve(uploadsRoot);
  const resolvedQuarantineRoot = path.resolve(quarantineRoot);

  const quarantine = async ({ jobId, filePaths = [] }) => {
    const entries = [];
    try {
      for (const filePath of filePaths) {
        const originalPath = assertInsideRoot(filePath, resolvedUploadsRoot, 'uploads root');
        const relativePath = path.relative(resolvedUploadsRoot, originalPath);
        const quarantinePath = assertInsideRoot(
          path.join(resolvedQuarantineRoot, String(jobId), relativePath),
          resolvedQuarantineRoot,
          'quarantine root',
        );
        try {
          await moveFile(originalPath, quarantinePath);
          entries.push({ originalPath, quarantinePath, missing: false });
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          entries.push({ originalPath, quarantinePath, missing: true });
        }
      }
      return entries;
    } catch (error) {
      try {
        for (const entry of [...entries].reverse()) {
          if (!entry.missing) await moveFile(entry.quarantinePath, entry.originalPath);
        }
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          'File quarantine failed and automatic restore was incomplete',
          { cause: restoreError },
        );
      }
      throw error;
    }
  };

  const restore = async ({ entries = [] }) => {
    for (const entry of entries) {
      if (!entry.missing) {
        await moveFile(entry.quarantinePath, entry.originalPath);
      }
    }
    return { restoredCount: entries.filter((entry) => !entry.missing).length };
  };

  const finalize = async ({ entries = [] }) => {
    let deletedCount = 0;
    for (const entry of entries) {
      if (entry.missing) continue;
      try {
        await fs.unlink(entry.quarantinePath);
        deletedCount += 1;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return { deletedCount };
  };

  return { quarantine, restore, finalize };
};
