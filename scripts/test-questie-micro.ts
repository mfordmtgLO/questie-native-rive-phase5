import assert from 'node:assert/strict';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve('questie-site');
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.riv': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
};

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(req) {
    const p = decodeURIComponent(new URL(req.url).pathname);
    const file = resolve(root, '.' + (p.endsWith('/') ? p + 'index.html' : p));
    if (!file.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
    const f = Bun.file(file);
    return (await f.exists())
      ? new Response(f, { headers: { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' } })
      : new Response('Missing', { status: 404 });
  },
});

const base = 'http://127.0.0.1:' + server.port;

try {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1024]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => {
        if (r.url().startsWith(base) && r.status() >= 400 && !r.url().endsWith('favicon.ico')) {
          errors.push(`${r.status()} ${r.url()}`);
        }
      });

      await page.goto(`${base}/muse-preview.html`);
      const waitState = async (id: string) =>
        page.waitForFunction(
          (expected) => document.querySelector('#status')?.getAttribute('data-behavior') === expected,
          id,
          { timeout: 30000 },
        );

      // 1. Living idle renders and animates continuously
      await waitState('IDLE-PARKED');
      const canvas = page.locator('#pin');
      assert.equal(Math.round((await canvas.boundingBox())!.width), 80, 'Default size must be 80px');
      const first = await canvas.screenshot();
      await page.waitForTimeout(1500);
      assert.ok(!first.equals(await canvas.screenshot()), 'Idle canvas pixels must change continuously');

      // 2. Typing -> pause thinking -> submit working -> educational reply -> return to idle
      await page.locator('#question').fill('down payment');
      await waitState('WORK-THINK');
      await waitState('TYPE-PONDER');
      await page.locator('#send').click();
      await waitState('WORK-THINK');
      await waitState('TYPE-LISTEN');
      assert.match(await page.locator('#reply').innerText(), /portion of the purchase price/);
      await waitState('IDLE-PARKED');

      // 3. Build demo guide workflow
      await page.locator('#build').click();
      await waitState('WORK-THINK');
      await waitState('TYPE-LISTEN');
      await waitState('IDLE-PARKED');

      // 4. All supported miniature sizes (48, 64, 80, 96, 128)
      for (const sz of [48, 64, 80, 96, 128]) {
        await page.locator('#size').selectOption(String(sz));
        const box = (await canvas.boundingBox())!;
        assert.equal(Math.round(box.width), sz, `Size ${sz}px width mismatch`);
        assert.equal(Math.round(box.height), sz, `Size ${sz}px height mismatch`);
      }

      // 5. Circle & transparent backgrounds + optional compact Pin label
      await page.locator('#bg-toggle').click();
      assert.equal(await page.locator('#pin-frame').getAttribute('data-bg'), 'transparent');
      await page.locator('#bg-toggle').click();
      assert.equal(await page.locator('#pin-frame').getAttribute('data-bg'), 'circle');

      await page.locator('#label-toggle').click();
      assert.equal(await page.locator('#pin-label').isVisible(), false);
      await page.locator('#label-toggle').click();
      assert.equal(await page.locator('#pin-label').isVisible(), true);

      // 6. 60-second continuous demo starts & stops cleanly
      await page.locator('#demo60').click();
      assert.equal(await page.locator('#demo60').getAttribute('aria-pressed'), 'true');
      await page.waitForTimeout(400);
      assert.match(await page.locator('#demo-progress').innerText(), /\/ 60s/);
      await page.locator('#demo60').click();
      assert.equal(await page.locator('#demo60').getAttribute('aria-pressed'), 'false');

      // 7. Standalone embed examples across root + both bundles
      for (const path of ['/embed-example.html', '/questie-pin/embed-example.html', '/questie-geo/embed-example.html']) {
        await page.goto(base + path);
        await page.locator('#controls button').first().waitFor({ timeout: 30000 });
      }

      assert.deepEqual(errors, [], `Browser errors at width ${width}`);
      await page.close();
    }
    console.log('Micro mascot desktop (1024) + iPhone mobile (390) verification PASSED.');
  } finally {
    await browser.close();
  }
} finally {
  server.stop(true);
}
