import { spawn } from 'node:child_process';

const splitCommand = (value) => String(value || '').trim().split(/\s+/).filter(Boolean);

const handleJsonLine = ({ line, callbacks, providerName }) => {
  if (!line.trim()) return;
  const event = JSON.parse(line);
  const text = String(event.text || '').trim();
  if (event.type === 'partial') callbacks.onPartial({ text, provider: providerName, raw: event });
  if (event.type === 'final') callbacks.onFinal({ text, provider: providerName, raw: event });
  if (event.type === 'error') callbacks.onError(event.message || event.error || `${providerName} adapter error`);
};

export const createSubprocessAsrProvider = async ({ providerName, commandLine, sampleRate, callbacks, integrationComplexity }) => {
  const parts = splitCommand(commandLine);
  if (!parts.length) throw new Error(`Set a command for ${providerName} subprocess ASR adapter.`);

  const [command, ...args] = parts;
  const child = spawn(command, args, {
    env: {
      ...process.env,
      ASR_SAMPLE_RATE: String(sampleRate),
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuffer = '';
  let stderrBuffer = '';
  let closeCode = null;
  let closeSignal = null;
  let stdinError = null;

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString('utf8');
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || '';
    for (const line of lines) {
      try {
        handleJsonLine({ line, callbacks, providerName });
      } catch (error) {
        callbacks.onError(`Invalid ${providerName} JSONL event: ${error.message}`);
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString('utf8');
  });

  child.stdin.on('error', (error) => {
    stdinError = error;
  });

  const closePromise = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      closeCode = code;
      closeSignal = signal;
      resolve();
    });
  });

  return {
    name: providerName,
    write: (chunk) => {
      if (stdinError || closeCode !== null || !child.stdin.writable) return;
      try {
        child.stdin.write(chunk);
      } catch (error) {
        stdinError = error;
      }
    },
    finalize: async () => {
      if (!stdinError && child.stdin.writable) child.stdin.end();
      await closePromise;
      if (stdoutBuffer.trim()) {
        try {
          handleJsonLine({ line: stdoutBuffer, callbacks, providerName });
        } catch (error) {
          callbacks.onError(`Invalid trailing ${providerName} JSONL event: ${error.message}`);
        }
      }
      if (closeCode !== 0) {
        const stdinDetails = stdinError ? `; stdin error: ${stdinError.message}` : '';
        throw new Error(`${providerName} subprocess exited with code ${closeCode}${closeSignal ? ` signal ${closeSignal}` : ''}${stdinDetails}${stderrBuffer ? `: ${stderrBuffer.slice(-1000)}` : ''}`);
      }
    },
    integrationComplexity,
  };
};
