import dns from 'dns/promises';
import net from 'net';

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

const PRIVATE_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

const isPrivateIp = (address = '') => {
  const ipVersion = net.isIP(address);
  if (!ipVersion) return false;
  if (ipVersion === 4) return PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(address));
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
};

export const normalizeSafeHttpUrl = (value = '') => {
  try {
    const parsed = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    parsed.hash = '';
    return parsed;
  } catch {
    return null;
  }
};

export const isPublicHttpUrl = async (value = '') => {
  const parsed = normalizeSafeHttpUrl(value);
  if (!parsed) return false;

  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(hostname) || isPrivateIp(hostname)) return false;

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses.length) return false;
    return addresses.every((item) => !isPrivateIp(item.address));
  } catch {
    return false;
  }
};
