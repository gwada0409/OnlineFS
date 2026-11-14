import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PWA release contract', () => {
  const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
  const worker = readFileSync(resolve(process.cwd(), 'src/sw.ts'), 'utf8');

  it('uses a prompt update strategy and an installable standalone manifest', () => {
    expect(config).toContain("strategies: 'injectManifest'");
    expect(config).toContain("registerType: 'prompt'");
    expect(config).toContain("display: 'standalone'");
    expect(config).toContain("purpose: 'maskable'");
  });

  it('keeps employee API responses out of the service-worker cache', () => {
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain("url.pathname.startsWith('/hubs/')");
  });
});
