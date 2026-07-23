import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const FRONTEND_ROOT = path.resolve(process.cwd());
export const BACKEND_ROOT = path.resolve(process.cwd(), '../backend');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const dynamicBackendImport = async (relativePath) =>
  import(pathToFileURL(path.join(BACKEND_ROOT, relativePath)).href);

export const waitForHttp = async (url, timeoutMs = 300_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

export const configureE2eAuthEnv = ({
  jwtSecret = 'e2e-refine-jwt-secret',
  googleClientId = 'e2e-refine-google-client',
} = {}) => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || jwtSecret;
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || googleClientId;
  return {
    jwtSecret: process.env.JWT_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  };
};

export const startBackendServer = async ({
  backendBaseUrl,
  backendPort,
  frontendBaseUrl,
  env = {},
} = {}) => {
  if (backendBaseUrl) {
    await waitForHttp(`${backendBaseUrl}/api/health`);
    return null;
  }

  const child = spawn(process.execPath, ['index.js'], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      AI_TEST_MODE: 'mock',
      PORT: String(backendPort),
      FRONTEND_ORIGIN: frontendBaseUrl,
      POSTGRES_REQUIRED: 'true',
      MONGO_REQUIRED: 'true',
      RECORDING_WORKER_ENABLED: 'false',
      RETENTION_WORKER_ENABLED: 'false',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(`http://127.0.0.1:${backendPort}/api/health`);
  return child;
};

export const startFrontendServer = async ({ frontendBaseUrl, frontendPort, backendBaseUrl }) => {
  if (frontendBaseUrl) {
    await waitForHttp(frontendBaseUrl);
    return null;
  }

  const viteBin = path.join(FRONTEND_ROOT, 'node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(frontendPort)], {
    cwd: FRONTEND_ROOT,
    env: {
      ...process.env,
      VITE_API_BASE_URL: backendBaseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(`http://127.0.0.1:${frontendPort}`);
  return child;
};

export const closeSeedConnections = async () => {
  const [{ closePostgres }, { disconnectMongo }] = await Promise.all([
    dynamicBackendImport('src/db/postgres.js'),
    dynamicBackendImport('src/db/mongo.js'),
  ]);
  await Promise.allSettled([closePostgres(), disconnectMongo()]);
};

export const seedSyntheticUser = async ({
  emailPrefix = 'e2e-refine',
  name = 'E2E Refine Candidate',
} = {}) => {
  configureE2eAuthEnv();
  const [{ bootstrapDatabases }, authService, { generateAuthToken }] = await Promise.all([
    dynamicBackendImport('src/db/bootstrap.js'),
    dynamicBackendImport('src/services/authService.js'),
    dynamicBackendImport('src/services/authTokenService.js'),
  ]);

  await bootstrapDatabases({ mongoRequired: true, postgresRequired: true });
  const uniqueId = `${Date.now()}-${crypto.randomUUID()}`;
  const user = await authService.findOrCreateGoogleUser({
    email: `${emailPrefix}-${uniqueId}@example.test`,
    name,
    googleSub: `${emailPrefix}-${uniqueId}`,
    termsAccepted: true,
    policyVersion: authService.CURRENT_PRIVACY_POLICY_VERSION,
  });

  return { user, token: generateAuthToken(user.id) };
};

export const createSyntheticCv = async ({ userId, filename = 'e2e-refine-cv.txt' } = {}) => {
  const cvText = [
    'Ava Chen',
    'Frontend Voice Systems Engineer',
    'Built React voice interfaces with WebSocket streaming, Playwright E2E checks, and latency instrumentation.',
    'Implemented retryable recording upload recovery, PostgreSQL session storage, MongoDB document evidence, and report QA checks.',
    'Skills: React, WebSocket, Playwright, Node.js, Express, PostgreSQL, MongoDB, voice latency instrumentation.',
  ].join('\n');

  const [{ saveTextToLocalStorage }, fileRepository] = await Promise.all([
    dynamicBackendImport('src/services/storageService.js'),
    dynamicBackendImport('src/services/fileRepositoryService.js'),
  ]);
  const storage = await saveTextToLocalStorage({
    text: cvText,
    suggestedFilename: filename,
    folder: 'cv',
  });
  const checksum = crypto.createHash('sha256').update(cvText).digest('hex');
  const cvId = await fileRepository.createUploadedFileRecord({
    userId,
    fileRole: 'cv',
    originalFilename: filename,
    mimeType: 'text/plain',
    storageProvider: storage.storageProvider,
    storageKey: storage.storageKey,
    fileSizeBytes: Buffer.byteLength(cvText),
    checksum,
    isEncrypted: storage.isEncrypted,
    virusScanStatus: storage.virusScanStatus,
    virusScannedAt: storage.virusScannedAt,
  });
  const cvProfile = {
    schemaVersion: 'cv_profile_v2',
    candidateName: 'Ava Chen',
    summary: 'Frontend voice systems engineer with React, WebSocket, Playwright and latency instrumentation experience.',
    skills: [
      { label: 'React' },
      { label: 'WebSocket' },
      { label: 'Playwright' },
      { label: 'PostgreSQL' },
      { label: 'MongoDB' },
    ],
    evidenceProfile: {
      functionalCapabilities: [
        'Voice UX engineering',
        'Browser E2E validation',
      ],
      quantifiedEvidence: ['Measured speech-end to first-audio latency in duplex voice flows.'],
    },
    confidence: 0.9,
    warnings: [],
  };
  const displayProfile = {
    fileId: cvId,
    candidateName: cvProfile.candidateName,
    summary: cvProfile.summary,
    topSkills: cvProfile.skills.map((skill) => skill.label),
    warnings: [],
  };

  await fileRepository.attachDocumentContent({
    fileId: cvId,
    userId,
    documentType: 'cv',
    rawText: cvText,
    normalizedText: cvText,
    redactedText: cvProfile.summary,
    parseWarnings: [],
    parseConfidence: 0.9,
    extractedSections: [],
    cvProfile,
    displayProfile,
  });

  return { cvId, cvText, cvProfile, storageKey: storage.storageKey };
};

export const buildRoleFitRubric = ({ reviewStatus = 'verified', jdFingerprint = 'e2e-refine-jd-fingerprint' } = {}) => ({
  schemaVersion: 'v3',
  title: 'Frontend Voice Systems Engineer',
  jobTitle: 'Frontend Voice Systems Engineer',
  jobOverview: {
    title: 'Frontend Voice Systems Engineer',
    companyName: 'Kiwi E2E Refine Ltd',
    location: 'Auckland',
  },
  sections: {
    responsibilities: ['Build realtime browser voice interview workflows'],
    mustHaveRequirements: ['React voice UX', 'WebSocket debugging', 'latency instrumentation'],
    niceToHaveRequirements: ['speech provider integration'],
    qualifications: [],
    softSkills: ['clear communication'],
    technicalSkills: {
      softwareDevelopment: [
        { label: 'React' },
        { label: 'WebSocket' },
        { label: 'Playwright' },
      ],
    },
  },
  mustHaveRequirements: ['React voice UX', 'WebSocket debugging', 'latency instrumentation'],
  technicalSkillRequirements: ['React', 'WebSocket', 'Playwright'],
  roleFit: {
    id: 'role-fit-e2e-refine',
    jdFingerprint,
    companyContext: { status: 'ready' },
    review: { status: reviewStatus, version: reviewStatus === 'verified' ? 2 : 1 },
    roleIntent: {
      items: [
        { id: 'intent:voice-ui', statement: 'Build browser voice UX', priority: 'high' },
        { id: 'intent:latency', statement: 'Measure and improve duplex latency', priority: 'high' },
      ],
    },
  },
  metadata: {
    humanReviewStatus: reviewStatus === 'verified' ? 'verified' : 'edited',
    inputTrustLevel: reviewStatus === 'verified' ? 'role_fit_verified' : 'draft',
  },
  diagnostics: {
    analysisMode: reviewStatus === 'verified' ? 'human_reviewed' : 'needs_review',
    confidence: reviewStatus === 'verified' ? 0.96 : 0.42,
    warnings: [],
    missingSections: [],
  },
});

export const seedVerifiedRoleFitReview = async ({ userId, jdRubric } = {}) => {
  const { saveCompanyValuesProfile } = await dynamicBackendImport('src/services/company/companyValuesRepository.js');
  const jdFingerprint = jdRubric?.roleFit?.jdFingerprint;
  if (!userId || !jdFingerprint || !jdRubric?.roleFit?.id) {
    throw new Error('Cannot seed verified role-fit review without userId, jdFingerprint, and roleFit id.');
  }

  return saveCompanyValuesProfile({
    userId,
    jdFingerprint,
    companyName: jdRubric.jobOverview?.companyName || 'Kiwi E2E Refine Ltd',
    location: jdRubric.jobOverview?.location || 'Auckland',
    status: 'ready',
    source: 'manual',
    confidence: 0.96,
    roleFitProfile: jdRubric.roleFit,
    roleFitReviewVersion: jdRubric.roleFit.review?.version,
    roleFitReviewStatus: 'verified',
    roleFitReviewedAt: new Date(),
    jdRubric,
  });
};

export const apiRequest = async ({
  backendBaseUrl,
  token,
  method = 'GET',
  endpoint,
  body,
} = {}) => {
  const response = await fetch(`${backendBaseUrl}/api${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { rawText: text };
  }
  return {
    method,
    endpoint,
    status: response.status,
    ok: response.ok,
    payload,
    data: payload?.data ?? payload,
  };
};

export const stopProcess = async (child) => {
  if (!child) return;
  child.kill('SIGTERM');
  await sleep(250);
};
