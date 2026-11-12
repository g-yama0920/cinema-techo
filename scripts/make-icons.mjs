// public/*.svg から PWA 用 PNG アイコンを生成する（Playwright の Chromium を使用）
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const jobs = [
  ['public/favicon.svg', 'public/pwa-192.png', 192],
  ['public/favicon.svg', 'public/pwa-512.png', 512],
  ['public/maskable.svg', 'public/pwa-maskable-512.png', 512],
  ['public/favicon.svg', 'public/apple-touch-icon.png', 180],
];
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [src, out, size] of jobs) {
  const svg = readFileSync(src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', out);
}
await browser.close();
