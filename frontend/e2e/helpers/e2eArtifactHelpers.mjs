import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const getPlaywrightOutputRoot = () => path.resolve(process.cwd(), '../output/playwright');

export const writeE2eArtifact = async (filename, artifact) => {
  const outputRoot = getPlaywrightOutputRoot();
  await fs.mkdir(outputRoot, { recursive: true });
  const artifactPath = path.join(outputRoot, filename);
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifactPath;
};

export const buildBaseArtifact = ({
  schemaVersion,
  truthLevel,
  resultType,
  passed = false,
  assertions = [],
  knownIssues = [],
  blockers = [],
  browserErrors = [],
  apiCalls = [],
  extra = {},
} = {}) => ({
  schemaVersion,
  generatedAt: new Date().toISOString(),
  passed,
  truthLevel,
  resultType,
  assertions,
  knownIssues,
  blockers,
  browserErrors,
  apiCalls,
  ...extra,
});

export const toBrowserErrorMessage = (source, error) =>
  `[${source}] ${error?.message || String(error)}`;
