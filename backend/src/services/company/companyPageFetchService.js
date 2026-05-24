import { isPublicHttpUrl, normalizeSafeHttpUrl } from './urlSafetyService.js';

const COMPANY_VALUE_PATHS = [
  '/',
  '/about',
  '/about-us',
  '/careers',
  '/culture',
  '/values',
  '/mission',
  '/who-we-are',
];

const MAX_PAGE_TEXT_CHARS = 80000;

export const htmlToReadableText = (html = '') =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PAGE_TEXT_CHARS);

export const fetchCompanyValuePages = async ({ websiteUrl } = {}) => {
  const baseUrl = normalizeSafeHttpUrl(websiteUrl);
  if (!baseUrl || !(await isPublicHttpUrl(baseUrl.toString()))) return [];

  const maxPages = Number(process.env.COMPANY_VALUES_MAX_PAGES || 6);
  const timeoutMs = Number(process.env.COMPANY_VALUES_PAGE_TIMEOUT_MS || 10000);
  const urls = COMPANY_VALUE_PATHS
    .map((path) => new URL(path, baseUrl.origin).toString())
    .slice(0, maxPages);

  const pages = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'KiwiAIInterviewAgent/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        pages.push({ url, text: '', textPreview: '', status: 'redirect_blocked' });
        continue;
      }

      if (!response.ok) {
        pages.push({ url, text: '', textPreview: '', status: `http_${response.status}` });
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        pages.push({ url, text: '', textPreview: '', status: 'non_html' });
        continue;
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 1000000) {
        pages.push({ url, text: '', textPreview: '', status: 'too_large' });
        continue;
      }

      const html = await response.text();
      const text = htmlToReadableText(html);
      pages.push({
        url,
        text,
        textPreview: text.slice(0, 300),
        status: text.length >= 300 ? 'fetched' : 'too_short',
      });
    } catch (error) {
      pages.push({
        url,
        text: '',
        textPreview: '',
        status: error?.name === 'TimeoutError' ? 'timeout' : 'failed',
        errorMessage: error?.message || 'fetch_failed',
      });
    }
  }

  return pages;
};
