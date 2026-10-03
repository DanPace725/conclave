// Renders docs/explainer/conclave-explainer.html to stills or an MP4.
// Usage: node scripts/render-explainer.mjs stills 5,12,20   |   node scripts/render-explainer.mjs video out.mp4 [fps]
// Needs Playwright (not a project dependency; `npm i --no-save playwright`) and, for video, ffmpeg on PATH.
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [mode = 'stills', arg = '0,10,20,30,40,50,60', fpsArg = '30'] = process.argv.slice(2);
const source = resolve(import.meta.dirname, '../docs/explainer/conclave-explainer.html');
const work = mkdtempSync(join(tmpdir(), 'explainer-'));
const page = join(work, 'index.html');
writeFileSync(page, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${readFileSync(source, 'utf8')}</body></html>`);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
// Fetch Google Fonts through curl so headless Chromium works behind a proxy as well.
await tab.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => {
  const res = spawnSync('curl', ['-sSf', '-A', 'Mozilla/5.0 Chrome/140', route.request().url()], { maxBuffer: 1 << 26 });
  if (res.status !== 0) return route.abort();
  const css = route.request().url().includes('googleapis');
  return route.fulfill({ status: 200, body: res.stdout, contentType: css ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
});
await tab.goto(`file://${page}#render`, { waitUntil: 'networkidle' });
await tab.evaluate(() => document.fonts.ready);
const shoot = async (t, file) => { await tab.evaluate((t) => window.renderAt(t), t); await tab.screenshot({ path: file, clip: { x: 0, y: 0, width: 1280, height: 720 } }); };

if (mode === 'stills') {
  for (const t of arg.split(',').map(Number)) await shoot(t, `explainer-${String(t).padStart(2, '0')}.png`);
} else {
  const fps = Number(fpsArg), total = await tab.evaluate(() => window.DURATION);
  const frames = Math.round(total * fps) + fps; // one second of hold at the end
  for (let i = 0; i < frames; i++) await shoot(Math.min(total, i / fps), join(work, `f${String(i).padStart(5, '0')}.png`));
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(work, 'f%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', resolve(arg)], { stdio: 'inherit' });
  if (ff.status !== 0) process.exitCode = 1;
}
await browser.close();
rmSync(work, { recursive: true, force: true });
