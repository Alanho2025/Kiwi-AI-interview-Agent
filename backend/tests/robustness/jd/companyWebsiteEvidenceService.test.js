import { describe, expect, it, vi } from 'vitest';

import { fetchCompanyWebsiteEvidence } from '../../../src/services/jobDescription/companyWebsiteEvidenceService.js';

const headersFrom = (values = {}) => ({
  get: (name) => values[name.toLowerCase()] || values[name] || '',
});

describe('company website evidence service', () => {
  it('blocks non-public URLs before fetch', async () => {
    const fetchImpl = vi.fn();

    const evidence = await fetchCompanyWebsiteEvidence({
      companyWebsiteUrl: 'http://127.0.0.1/admin',
      fetchImpl,
      publicUrlChecker: vi.fn(async () => false),
    });

    expect(evidence.fetchStatus).toBe('blocked');
    expect(evidence.safetyBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'private_or_non_public_host' }),
    ]));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not follow cross-host redirects', async () => {
    const evidence = await fetchCompanyWebsiteEvidence({
      companyWebsiteUrl: 'https://luma.example',
      publicUrlChecker: vi.fn(async () => true),
      fetchImpl: vi.fn(async () => ({
        status: 302,
        ok: false,
        headers: headersFrom({ location: 'https://other.example/about' }),
      })),
    });

    expect(evidence.fetchStatus).toBe('blocked');
    expect(evidence.safetyBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'redirect_blocked' }),
    ]));
    expect(evidence.pages).toEqual([]);
  });

  it('extracts bounded snippets from HTML without storing full page bodies', async () => {
    const html = `
      <html>
        <head><title>Luma Analytics</title></head>
        <body>
          <main>
            <h1>Luma Analytics helps energy operations teams make trusted decisions.</h1>
            <p>Our platform turns messy operational data into planning dashboards and alert workflows for field teams.</p>
            <p>We work with analysts, engineers, and operational leaders who need reliable data products.</p>
          </main>
        </body>
      </html>
    `;

    const evidence = await fetchCompanyWebsiteEvidence({
      companyWebsiteUrl: 'https://luma.example/about',
      publicUrlChecker: vi.fn(async () => true),
      fetchImpl: vi.fn(async () => ({
        status: 200,
        ok: true,
        url: 'https://luma.example/about',
        headers: headersFrom({ 'content-type': 'text/html', 'content-length': String(html.length) }),
        text: vi.fn(async () => html),
      })),
    });

    expect(evidence.fetchStatus).toBe('fetched');
    expect(evidence.pages[0]).toEqual(expect.objectContaining({
      url: 'https://luma.example/about',
      snippets: expect.arrayContaining([
        expect.stringMatching(/energy operations teams/i),
      ]),
    }));
    expect(JSON.stringify(evidence)).not.toMatch(/<html>|<main>/i);
  });

  it('captures bounded same-origin candidate pages when available', async () => {
    const htmlByUrl = {
      'https://luma.example': `
        <html><body>
          <p>Luma Analytics builds planning software for energy teams.</p>
        </body></html>
      `,
      'https://luma.example/about': `
        <html><body>
          <p>Our product helps operations leaders turn field data into trusted daily decisions.</p>
        </body></html>
      `,
    };
    const fetchImpl = vi.fn(async (url) => ({
      status: 200,
      ok: true,
      url,
      headers: headersFrom({ 'content-type': 'text/html', 'content-length': String(htmlByUrl[url].length) }),
      text: vi.fn(async () => htmlByUrl[url]),
    }));

    const evidence = await fetchCompanyWebsiteEvidence({
      companyWebsiteUrl: 'https://luma.example',
      publicUrlChecker: vi.fn(async () => true),
      fetchImpl,
      maxPages: 2,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://luma.example',
      'https://luma.example/about',
    ]);
    expect(evidence.fetchStatus).toBe('fetched');
    expect(evidence.pages.map((page) => page.url)).toEqual([
      'https://luma.example',
      'https://luma.example/about',
    ]);
    expect(JSON.stringify(evidence)).not.toMatch(/<html>|<body>/i);
  });
});
