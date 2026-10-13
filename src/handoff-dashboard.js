import express from 'express';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HandoffRepository } from './handoff-repository.js';
import { hostedDashboardHtml } from './handoff-branding.js';

const assets = new Map(['index.html', 'app.js', 'app.css', 'graph.js', 'graph.css', 'onboarding.js', 'onboarding.css'].map(name =>
  [name, readFileSync(new URL(`./resources/dashboard/${name}`, import.meta.url), 'utf8')]));
// These installation/offline resources contain no account data and must remain
// available after a session expires, including for browser worker update checks.
const publicAssets = new Map(['manifest.webmanifest', 'pwa.js', 'sw.js', 'offline.html', 'offline.css',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'].map(name =>
  [`/${name}`, { content: readFileSync(new URL(`./resources/dashboard/${name}`, import.meta.url)),
    type: name.endsWith('.webmanifest') ? 'application/manifest+json' : name.split('.').at(-1) }]));
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const invalid = () => { throw Object.assign(Error('Invalid dashboard request'), { code: 'invalid_input' }); };

// Read-only browser adapter over the same owner-scoped packet operations as MCP.
// No browser bearer tokens, model calls, new tables, or packet writes.
export function createHandoffDashboard({ pool, origin, identity, repository = owner => new HandoffRepository(pool, owner), hostedPresentation = false }) {
  const router = express.Router(), host = new URL(origin).host;
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin', 'Content-Security-Policy': policy });
    // External links and installed-app launches may be cross-site navigations.
    // Worker-forwarded navigations retain navigate mode but have an empty
    // destination in Chromium. Framing remains denied by frame-ancestors.
    // Allow only the read-only shell; API and resource guards remain.
    const shellNavigation = req.path === '/' && req.method === 'GET'
      && req.headers['sec-fetch-mode'] === 'navigate' && ['document', 'empty'].includes(req.headers['sec-fetch-dest']);
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== origin)
      || (req.headers['sec-fetch-site'] === 'cross-site' && !shellNavigation))
      return res.status(403).json({ error: 'forbidden' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).set('Allow', 'GET, HEAD').json({ error: 'read_only' });
    const asset = publicAssets.get(req.path);
    if (asset) return res.type(asset.type).send(asset.content);
    const user = identity(req);
    if (!user?.id) return req.path.startsWith('/api/') ? res.status(401).json({ error: 'sign_in_required' }) : res.redirect(303, '/');
    res.locals.owner = user.id;
    res.locals.setupKey = createHash('sha256').update(`conclave-setup:${user.id}`).digest('hex');
    res.locals.email = user.email;
    // Bind wizard reads to the displayed account, including after a tab switches sessions.
    if (req.headers['x-conclave-setup-account'] && req.headers['x-conclave-setup-account'] !== res.locals.setupKey)
      return res.status(409).json({ error: 'account_changed' });
    next();
  });
  router.get(['/', '/app.js', '/app.css', '/graph.js', '/graph.css', '/onboarding.js', '/onboarding.css'], (req, res) => {
    const name = req.path === '/' ? 'index.html' : req.path.slice(1);
    const content = assets.get(name);
    res.type(name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : 'html').send(name === 'index.html' && hostedPresentation ? hostedDashboardHtml(content) : content);
  });
  router.get('/api/setup', (req, res) => {
    if (!hostedPresentation) return res.status(404).json({ error: 'not_found' });
    if (Object.keys(req.query).length) return res.status(400).json({ error: 'invalid_input' });
    res.json({ account_email: res.locals.email || 'your signed-in Conclave account',
      resume_key: res.locals.setupKey, server_url: `${origin}/mcp` });
  });
  router.get('/api/:operation', async (req, res) => {
    try {
      const fields = { find: ['query', 'offset', 'project'], get: ['handoff_id', 'revision', 'format'], graph: ['project'],
        history: ['handoff_id', 'offset'], compare: ['handoff_id', 'from_revision', 'to_revision'] };
      const operation = req.params.operation, allowed = Object.hasOwn(fields, operation) ? fields[operation] : null;
      if (!allowed) return res.status(404).json({ error: 'not_found' });
      const input = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (!allowed.includes(key) || typeof value !== 'string') invalid();
        if (['offset', 'revision', 'from_revision', 'to_revision'].includes(key)) {
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) invalid();
          input[key] = Number(value);
        } else input[key] = value;
      }
      if (operation === 'find' || operation === 'history') input.limit = 10;
      if (operation === 'get' || operation === 'compare') input.max_characters = 128000;
      res.json(await repository(res.locals.owner)[operation](input));
    } catch (error) {
      const statuses = { invalid_input: 400, not_found: 404, capacity: 413 };
      res.status(statuses[error.code] || 503).json({ error: statuses[error.code] ? error.code : 'unavailable' });
    }
  });
  router.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  return router;
}
