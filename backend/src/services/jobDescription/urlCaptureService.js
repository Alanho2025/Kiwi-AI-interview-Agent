import dns from 'dns/promises';
import { badRequest } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

/**
 * Checks if a given IP address is private, loopback, link-local, multicast, or unspecified.
 * Supports both IPv4 and IPv6.
 * @param {string} ip 
 * @returns {boolean}
 */
export const isBlockedIp = (ip) => {
  if (!ip) return true;

  // IPv4 Check
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [a, b] = parts;
    return (
      a === 127 || // Loopback
      a === 10 || // Private Network
      (a === 172 && b >= 16 && b <= 31) || // Private Network
      (a === 192 && b === 168) || // Private Network
      (a === 169 && b === 254) || // Link-local
      a === 0 || // Unspecified / Any
      a >= 224 // Multicast / Reserved
    );
  }

  // IPv6 Check
  if (ip.includes(':')) {
    const cleanIp = ip.toLowerCase().trim();
    return (
      cleanIp === '::1' || // Loopback
      cleanIp === '::' || // Unspecified
      cleanIp.startsWith('fe80:') || // Link-local
      cleanIp.startsWith('fc00:') || // Unique local
      cleanIp.startsWith('fd00:') // Unique local
    );
  }

  return true;
};

/**
 * Validates the URL to prevent SSRF by checking if it resolves to a local/private IP.
 * @param {string} urlString 
 * @returns {Promise<string>} The validated, normalized URL string.
 */
export const validateUrlForCapture = async (urlString) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString.trim());
  } catch {
    throw badRequest('Invalid URL', 'The provided text is not a valid HTTP or HTTPS URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw badRequest('Unsupported Scheme', 'Only http:// and https:// URLs are supported.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Prevent simple localhost / local domain bypasses directly
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
    throw badRequest('Blocked Source', 'Private or local hosts are not allowed.');
  }

  try {
    // Resolve host to IPs
    const lookupResult = await dns.lookup(hostname, { all: true });
    const ips = lookupResult.map(entry => entry.address);

    for (const ip of ips) {
      if (isBlockedIp(ip)) {
        logger.warn(`SSRF Blocked: URL resolved to a blocked private/local IP: ${ip} for host ${hostname}`);
        throw badRequest('Blocked Source', 'The URL host resolves to a private or local network address.');
      }
    }
  } catch (error) {
    if (error.statusCode) throw error; // Re-throw badRequest
    logger.warn(`DNS lookup failed for hostname: ${hostname}`, error);
    throw badRequest('DNS Lookup Failed', 'Could not resolve host IP address.');
  }

  return parsedUrl.toString();
};

/**
 * Extracts visible text from raw HTML by removing scripts, styles, navigations, footers, etc.
 * @param {string} html 
 * @returns {string} Cleaned visible text
 */
export const extractVisibleText = (html = '') => {
  let text = html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, ' ')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, ' ')
    .replace(/<nav[^>]*>([\s\S]*?)<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>([\s\S]*?)<\/footer>/gi, ' ')
    .replace(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi, ' ');

  // Convert other common block level elements to linebreaks/spaces
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode standard HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
};

/**
 * Securely fetches HTML content from the given URL and returns the visible text.
 * @param {string} urlString 
 * @returns {Promise<{ visibleText: string, finalUrl: string }>}
 */
export const captureUrlContent = async (urlString) => {
  const validatedUrl = await validateUrlForCapture(urlString);

  try {
    const response = await fetch(validatedUrl, {
      headers: {
        'User-Agent': 'KiwiCoach/1.0 (JobDescriptionParser)',
        'Accept': 'text/html,text/plain,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000), // 5 seconds timeout
    });

    if (!response.ok) {
      throw badRequest('Fetch Failed', `The job posting webpage returned an HTTP error status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
      throw badRequest('Unsupported Content Type', 'The job posting URL did not return a valid HTML or text document.');
    }

    const htmlContent = await response.text();
    const visibleText = extractVisibleText(htmlContent);

    if (!visibleText) {
      throw badRequest('Extraction Failed', 'No visible text could be parsed from the job description URL.');
    }

    return {
      visibleText,
      finalUrl: response.url || validatedUrl,
    };
  } catch (error) {
    if (error.statusCode) throw error; // Re-throw badRequest
    logger.error(`Error fetching URL content: ${urlString}`, error);
    throw badRequest('Fetch Failed', `Failed to capture content from the provided URL: ${error.message}`);
  }
};
