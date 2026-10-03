// Renders docs/explainer/conclave-explainer.html to stills, an MP4, or caption files.
// Needs Playwright (not a project dependency; `npm i --no-save playwright`) and, for video, ffmpeg on PATH.
//
//   node scripts/render-explainer.mjs stills 5,j3+8,r2   # seconds, or a narration cue id plus an optional offset
//   node scripts/render-explainer.mjs video out.mp4 [fps]  # CAPTIONS=0 leaves subtitles out of the frames
//   node scripts/render-explainer.mjs captions out         # writes out.srt and out.vtt
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [mode = 'stills', arg = '0,30,60,90,120,150,180,210', fpsArg = '30'] = process.argv.slice(2);
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
if (process.env.CAPTIONS === '0') await tab.evaluate(() => window.setCaptions(false));
const { total, cues } = await tab.evaluate(() => ({ total: window.DURATION, cues: window.NARRATION }));
const shoot = async (t, file, type = 'png') => {
  await tab.evaluate((t) => window.renderAt(t), t);
  await tab.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 92 } : {}), clip: { x: 0, y: 0, width: 1280, height: 720 } });
};
const timeOf = (spec) => {
  const m = /^([a-z]\d+)([+-][\d.]+)?$/.exec(spec);
  if (!m) return Number(spec);
  const c = cues.find((q) => q.id === m[1]);
  if (!c) throw Error(`Unknown cue ${m[1]}`);
  return c.start + Number(m[2] || 0);
};
const stamp = (s) => {
  const ms = Math.round(s * 1000), p = (n, w = 2) => String(n).padStart(w, '0');
  return [p(Math.floor(ms / 3600000)), p(Math.floor(ms / 60000) % 60), p(Math.floor(ms / 1000) % 60)].join(':') + '.' + p(ms % 1000, 3);
};

if (mode === 'stills') {
  for (const spec of arg.split(',')) await shoot(timeOf(spec), `explainer-${spec}.png`);
} else if (mode === 'captions') {
  const span = (c) => `${stamp(c.start)} --> ${stamp(c.end + .45)}`;
  writeFileSync(`${arg}.srt`, cues.map((c, i) => `${i + 1}\n${span(c).replaceAll('.', ',')}\n${c.text}\n`).join('\n'));
  writeFileSync(`${arg}.vtt`, 'WEBVTT\n\n' + cues.map((c) => `${c.id}\n${span(c)}\n${c.text}\n`).join('\n'));
} else {
  const fps = Number(fpsArg), frames = Math.round(total * fps);
  for (let i = 0; i <= frames; i++) await shoot(Math.min(total, i / fps), join(work, `f${String(i).padStart(5, '0')}.jpg`), 'jpeg');
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(work, 'f%05d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', resolve(arg)], { stdio: 'inherit' });
  if (ff.status !== 0) process.exitCode = 1;
}
await browser.close();
rmSync(work, { recursive: true, force: true });
