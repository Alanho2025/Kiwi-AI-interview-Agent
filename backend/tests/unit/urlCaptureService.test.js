import { describe, expect, it } from 'vitest';
import { isBlockedIp, extractVisibleText, validateUrlForCapture, extractTargetedContainer } from '../../src/services/jobDescription/urlCaptureService.js';

describe('urlCaptureService unit tests', () => {
  describe('extractTargetedContainer', () => {
    it('extracts SEEK job description block accurately', () => {
      const html = '<div>Header</div><div data-automation="jobAdDetails"><div>Role Details</div></div><div>Footer</div>';
      const container = extractTargetedContainer(html);
      expect(container).toBe('<div data-automation="jobAdDetails"><div>Role Details</div></div>');
    });

    it('extracts Indeed job description block accurately', () => {
      const html = '<div>Header</div><div id="jobDescriptionText">Role Details</div><div>Footer</div>';
      const container = extractTargetedContainer(html);
      expect(container).toBe('<div id="jobDescriptionText">Role Details</div>');
    });

    it('handles nested divs of the same tag correctly', () => {
      const html = '<div>Header</div><div data-automation="jobAdDetails"><div>Nested <div>Deep</div></div></div><div>Footer</div>';
      const container = extractTargetedContainer(html);
      expect(container).toBe('<div data-automation="jobAdDetails"><div>Nested <div>Deep</div></div></div>');
    });
  });
  describe('isBlockedIp', () => {
    it('blocks loopback and private IPv4 addresses', () => {
      expect(isBlockedIp('127.0.0.1')).toBe(true);
      expect(isBlockedIp('10.0.0.5')).toBe(true);
      expect(isBlockedIp('172.16.5.9')).toBe(true);
      expect(isBlockedIp('192.168.1.10')).toBe(true);
      expect(isBlockedIp('169.254.0.1')).toBe(true);
      expect(isBlockedIp('0.0.0.0')).toBe(true);
    });

    it('allows public IPv4 addresses', () => {
      expect(isBlockedIp('8.8.8.8')).toBe(false);
      expect(isBlockedIp('104.244.42.1')).toBe(false);
    });

    it('blocks loopback and private IPv6 addresses', () => {
      expect(isBlockedIp('::1')).toBe(true);
      expect(isBlockedIp('::')).toBe(true);
      expect(isBlockedIp('fe80::1')).toBe(true);
      expect(isBlockedIp('fd00::9')).toBe(true);
    });

    it('allows public IPv6 addresses', () => {
      expect(isBlockedIp('2001:4860:4860::8888')).toBe(false);
    });

    it('blocks invalid inputs', () => {
      expect(isBlockedIp('')).toBe(true);
      expect(isBlockedIp(null)).toBe(true);
      expect(isBlockedIp('not-an-ip')).toBe(true);
    });
  });

  describe('extractVisibleText', () => {
    it('removes scripts and styles and keeps text content', () => {
      const html = '<html><head><style>body {color: red;}</style><script>alert(1);</script></head><body><nav><ul><li>Home</li></ul></nav><main><h1>Hello World</h1><p>This is a job description.</p></main><footer>Contact Us</footer></body></html>';
      const clean = extractVisibleText(html);
      expect(clean).toContain('Hello World');
      expect(clean).toContain('This is a job description.');
      expect(clean).not.toContain('alert(1)');
      expect(clean).not.toContain('body {color: red;}');
      expect(clean).not.toContain('Home');
      expect(clean).not.toContain('Contact Us');
    });

    it('decodes HTML entities and normalizes whitespace', () => {
      const html = '<div>Software&nbsp;Engineer &amp; Developer &lt;Senior&gt;</div>';
      const clean = extractVisibleText(html);
      expect(clean).toBe('Software Engineer & Developer <Senior>');
    });
  });

  describe('validateUrlForCapture', () => {
    it('throws badRequest for invalid or non-HTTP schemes', async () => {
      await expect(validateUrlForCapture('ftp://example.com')).rejects.toThrow();
      await expect(validateUrlForCapture('invalid-url')).rejects.toThrow();
    });

    it('throws badRequest for localhost and loopback hosts directly', async () => {
      await expect(validateUrlForCapture('http://localhost/job')).rejects.toThrow();
      await expect(validateUrlForCapture('https://127.0.0.1/job')).rejects.toThrow();
    });
  });
});
