import express from 'express';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../../../src/store.js';
import { HandoffService } from '../../../src/handoffs.js';
import { createHandoffDashboard } from '../../../src/handoff-dashboard.js';

// Explicit synthetic demo. No .env, saved local packets, hosted database or keys.
export async function startDashboardPreview({ port = 3226 } = {}) {
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  const packet = { title: 'Dashboard planning', summary: 'A shared place to see the work moving between apps.',
    objective: 'Make saved project continuity visible.', source_app: 'ChatGPT', source_model: 'Sol (demo)', project: 'Conclave dashboard',
    constraints: ['Keep source labels visible.', 'Ask before publishing.'], open_questions: ['Which default view?', 'How should projects be grouped?'],
    decisions: ['Start with recent handoffs.'], next_steps: ['Try this dashboard on desktop and a narrow screen.'],
    context: 'This is synthetic demo context.\n\nSaved packets are distinct from an app’s live memory.',
    clamp: { version: '1.0', kind: 'clyp', links: [] } };
  const first = service.save({ packet, request_id: 'dashboard-demo-first' });
  let linked;
  for (let i = 0; i < 11; i++) linked = service.save({ packet: { title: i === 0 ? 'Literal <img src=x onerror="window.xss=true">' : `Demo workstream ${i + 1}`,
    summary: 'Synthetic preview data.', source_app: i % 2 ? 'Claude' : 'Codex', constraints: ['Demo only.'], ...(i % 2 ? { project: 'Demo project' } : {}) }, request_id: `dashboard-demo-${i}` });
  packet.clamp.links = [{ relation: 'depends_on', handoff_id: linked.handoff_id, revision: 1 }];
  for (let i = 2; i <= 13; i++) service.save({ packet: { ...packet, summary: `Dashboard iteration ${i}. Synthetic preview data.`,
    constraints: ['Ask before publishing.'], open_questions: ['How should projects be grouped?'], source_app: i % 2 ? 'ChatGPT' : 'Claude' },
    handoff_id: first.handoff_id, expected_revision: i - 1, request_id: `dashboard-revision-${i}` });
  const app = express(), server = createServer(app);
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    app.get('/', (_req, res) => res.redirect('/dashboard'));
    app.get(['/connect', '/account'], (_req, res) => res.type('text').send('Synthetic preview only. No real account or app connections.'));
    const html = readFileSync(new URL('../../../src/resources/dashboard/index.html', import.meta.url), 'utf8');
    app.get(['/dashboard', '/dashboard/'], (req, res, next) => {
      if (req.headers.host !== new URL(origin).host) return res.sendStatus(403);
      if (req.headers.cookie?.includes('preview_expired=1')) return next();
      res.set({ 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'" });
      res.type('html').send(html.replace('<body>', '<body><p class="notice" role="note">Local demo · synthetic packets only. No live account data.</p>').replace('href="/">Account', 'href="/account">Account'));
    });
    app.use('/dashboard', createHandoffDashboard({ origin, identity: req => req.headers.cookie?.includes('preview_expired=1') ? null : { id: 'synthetic-demo' }, repository: () => service }));
    return { server, service, demoId: first.handoff_id, url: origin + '/dashboard', async close() {
      server.closeAllConnections(); await new Promise(done => server.close(done)); store.close();
    } };
  } catch (error) { server.close(); store.close(); throw error; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preview = await startDashboardPreview({ port: Number(process.env.CONCLAVE_DASHBOARD_PREVIEW_PORT || 3226) }); console.log(`Synthetic Conclave dashboard: ${preview.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void preview.close().then(() => process.exit()); });
}
