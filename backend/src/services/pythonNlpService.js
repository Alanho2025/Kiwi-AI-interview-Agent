import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBooleanEnv, getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');
const helperPath = path.join(backendRoot, 'python', 'nlp_helper.py');

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_STDOUT_BYTES = 8 * 1024 * 1024;
const MAX_STDERR_BYTES = 256 * 1024;

export const isOpenSourceNlpEnabled = () => getBooleanEnv('ENABLE_OPEN_SOURCE_NLP', false);

const getTimeoutMs = () => {
  const configured = Number(getEnv('PYTHON_NLP_TIMEOUT_MS'));
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
};

const getPythonBinary = () => getEnv('PYTHON_NLP_BIN') || 'python3';

const truncate = (value = '', maxBytes = MAX_STDERR_BYTES) => {
  const text = String(value || '');
  if (Buffer.byteLength(text) <= maxBytes) return text;
  return `${text.slice(0, maxBytes)}...`;
};

const runHelper = (args = []) => new Promise((resolve) => {
  if (!isOpenSourceNlpEnabled()) {
    resolve({ ok: false, skipped: true, reason: 'open_source_nlp_disabled' });
    return;
  }

  const child = spawn(getPythonBinary(), [helperPath, ...args], {
    cwd: backendRoot,
    env: {
      ...process.env,
      SENTENCE_TRANSFORMER_MODEL: getEnv('SENTENCE_TRANSFORMER_MODEL') || 'sentence-transformers/all-MiniLM-L6-v2',
      SPACY_MODEL: getEnv('SPACY_MODEL') || 'en_core_web_sm',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let settled = false;

  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill('SIGKILL');
    resolve({ ok: false, error: 'python_nlp_timeout', timeoutMs: getTimeoutMs() });
  }, getTimeoutMs());

  child.stdout.on('data', (chunk) => {
    if (Buffer.byteLength(stdout) < MAX_STDOUT_BYTES) {
      stdout += chunk.toString('utf8');
    }
  });

  child.stderr.on('data', (chunk) => {
    if (Buffer.byteLength(stderr) < MAX_STDERR_BYTES) {
      stderr += chunk.toString('utf8');
    }
  });

  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    resolve({ ok: false, error: error.message });
  });

  child.on('close', (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);

    let parsed;
    try {
      parsed = JSON.parse(stdout || '{}');
    } catch (_error) {
      resolve({
        ok: false,
        error: 'python_nlp_invalid_json',
        exitCode: code,
        stderr: truncate(stderr),
      });
      return;
    }

    if (code !== 0 || parsed?.ok === false) {
      resolve({
        ok: false,
        exitCode: code,
        error: parsed?.error || 'python_nlp_failed',
        stderr: truncate(stderr),
      });
      return;
    }

    resolve(parsed);
  });
});

const withTempDir = async (callback) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-nlp-'));
  try {
    return await callback(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const logFailure = (operation, result = {}) => {
  if (result?.skipped) return;
  logger.warn('Open-source NLP helper failed; using fallback path', {
    operation,
    error: result.error,
    exitCode: result.exitCode,
  });
};

export const extractPdfWithPdfplumber = async (fileBuffer) => {
  if (!isOpenSourceNlpEnabled()) return null;
  return withTempDir(async (tempDir) => {
    const inputPath = path.join(tempDir, 'input.pdf');
    await fs.writeFile(inputPath, fileBuffer);
    const result = await runHelper(['extract-pdf', '--input', inputPath]);
    if (!result.ok) {
      logFailure('extract-pdf', result);
      return null;
    }
    return {
      text: typeof result.text === 'string' ? result.text : '',
      metadata: {
        parser: result.parser || 'pdfplumber',
        pageCount: result.page_count || 0,
        layoutWarnings: Array.isArray(result.layout_warnings) ? result.layout_warnings : [],
      },
    };
  });
};

export const analyzeTextWithSpacy = async ({ kind = 'cv', text = '' } = {}) => {
  if (!isOpenSourceNlpEnabled()) return null;
  if (!String(text || '').trim()) return null;
  return withTempDir(async (tempDir) => {
    const inputPath = path.join(tempDir, 'input.txt');
    await fs.writeFile(inputPath, text, 'utf8');
    const result = await runHelper(['analyze-text', '--kind', kind, '--input', inputPath]);
    if (!result.ok) {
      logFailure(`analyze-text:${kind}`, result);
      return null;
    }
    return {
      parser: result.parser || 'spaCy',
      model: result.model || getEnv('SPACY_MODEL') || 'en_core_web_sm',
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      sentences: Array.isArray(result.sentences) ? result.sentences : [],
      nounChunks: Array.isArray(result.noun_chunks) ? result.noun_chunks : [],
      entities: Array.isArray(result.entities) ? result.entities : [],
      actionVerbs: Array.isArray(result.action_verbs) ? result.action_verbs : [],
      numericClaims: Array.isArray(result.numeric_claims) ? result.numeric_claims : [],
    };
  });
};

export const rankEvidenceWithSentenceTransformers = async ({ requirements = [], evidence = [], topK = 3 } = {}) => {
  if (!isOpenSourceNlpEnabled()) return null;
  if (!requirements.length || !evidence.length) return null;
  return withTempDir(async (tempDir) => {
    const requirementsPath = path.join(tempDir, 'requirements.json');
    const evidencePath = path.join(tempDir, 'evidence.json');
    await fs.writeFile(requirementsPath, JSON.stringify(requirements), 'utf8');
    await fs.writeFile(evidencePath, JSON.stringify(evidence), 'utf8');
    const result = await runHelper([
      'rank-evidence',
      '--requirements',
      requirementsPath,
      '--evidence',
      evidencePath,
      '--top-k',
      String(topK),
    ]);
    if (!result.ok) {
      logFailure('rank-evidence', result);
      return null;
    }
    return {
      model: result.model || getEnv('SENTENCE_TRANSFORMER_MODEL') || 'sentence-transformers/all-MiniLM-L6-v2',
      scorer: result.scorer || 'sentence-transformers',
      matches: Array.isArray(result.matches) ? result.matches : [],
    };
  });
};
