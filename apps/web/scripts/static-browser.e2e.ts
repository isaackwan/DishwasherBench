/**
 * Builds the static adapter fixture with a relative asset base, serves that production output,
 * and drives it in headless Chromium. No HTTP API, game server, or loaded-item wash is used.
 *
 * Run from the repository root with:
 *   pnpm exec tsx apps/web/scripts/static-browser.e2e.ts
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeFlags, resolveChrome } from '@spotless/render/headless';
import { launch } from 'puppeteer-core';
import { build, preview } from 'vite';

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configFile = join(appRoot, 'vite.config.ts');
const tempOutput = mkdtempSync(join(tmpdir(), 'spotless-static-browser-e2e-'));

async function main(): Promise<void> {
  process.env.VITE_STATIC_MODE = 'true';
  delete process.env.STATIC_QA;

  await build({
    root: appRoot,
    configFile,
    logLevel: 'error',
    build: {
      outDir: tempOutput,
      emptyOutDir: true,
      rollupOptions: {
        input: join(appRoot, 'static-browser-e2e.html'),
      },
    },
  });

  const server = await preview({
    root: appRoot,
    configFile,
    logLevel: 'error',
    build: { outDir: tempOutput },
    preview: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  if (address === null || typeof address === 'string') throw new Error('Preview server did not listen');
  const url = `http://127.0.0.1:${address.port}/static-browser-e2e.html`;

  let browser: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    browser = await launch({
      executablePath: resolveChrome(),
      headless: true,
      args: [...chromeFlags(), '--no-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 1280, height: 800 },
    });
    const page = await browser.newPage();
    const apiRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
    await page.waitForFunction(
      () => document.querySelector('#result')?.getAttribute('data-status') !== 'running',
      { timeout: 120_000, polling: 50 },
    );
    const result = await page.$eval('#result', (element) => ({
      status: element.getAttribute('data-status'),
      text: element.textContent ?? '',
    }));

    if (result.status !== 'passed') throw new Error(`Browser fixture failed:\n${result.text}`);
    if (apiRequests.length > 0) {
      throw new Error(`The static adapter made HTTP API requests: ${apiRequests.join(', ')}`);
    }
    if (pageErrors.length > 0) throw new Error(`Browser errors:\n${pageErrors.join('\n')}`);
    console.log(`Static browser adapter passed:\n${result.text}`);
  } finally {
    await browser?.close();
    await server.close();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => rmSync(tempOutput, { recursive: true, force: true }));
