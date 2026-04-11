/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: logger should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

const isProduction = process.env.NODE_ENV === 'production';

const toErrorPayload = (error) => {
  if (!error) {
    return undefined;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    details: error.details,
  };
};

const buildLogEntry = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  if (entry.error instanceof Error) {
    entry.error = toErrorPayload(entry.error);
  }

  return entry;
};

const formatValue = (value) => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
};

const flattenForConsole = (prefix, value, lines) => {
  if (value === null || value === undefined) {
    lines.push(`${prefix}: ${formatValue(value)}`);
    return;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      lines.push(`${prefix}: []`);
      return;
    }

    lines.push(`${prefix}:`);
    value.forEach((item, index) => {
      flattenForConsole(`${prefix}  [${index}]`, item, lines);
    });
    return;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) {
      lines.push(`${prefix}: {}`);
      return;
    }

    lines.push(`${prefix}:`);
    entries.forEach(([key, nestedValue]) => {
      flattenForConsole(`${prefix}  ${key}`, nestedValue, lines);
    });
    return;
  }

  lines.push(`${prefix}: ${formatValue(value)}`);
};

const formatPrettyLog = (payload) => {
  const header = `[${payload.timestamp}] ${String(payload.level || 'info').toUpperCase()} ${payload.message || ''}`.trim();
  const lines = [header];

  Object.entries(payload)
    .filter(([key]) => !['timestamp', 'level', 'message'].includes(key))
    .forEach(([key, value]) => {
      flattenForConsole(key, value, lines);
    });

  return lines.join('\n');
};

const write = (level, message, meta = {}) => {
  const payload = buildLogEntry(level, message, meta);
  const serialized = isProduction
    ? JSON.stringify(payload)
    : formatPrettyLog(payload);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

export const getRequestLogMeta = (req, extra = {}) => ({
  requestId: req?.requestContext?.requestId,
  userId: req?.user?.id || null,
  sessionId: req?.body?.sessionId || req?.params?.sessionId || extra.sessionId || null,
  method: req?.method,
  path: req?.originalUrl,
  ...extra,
});
