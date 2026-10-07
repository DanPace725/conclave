import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Store } from '../../../src/store.js';
import { HandoffService } from '../../../src/handoffs.js';
import { createHandoffMcpServer } from '../../../src/handoff-mcp-server.js';
import { handoffUiUri } from '../../../src/handoff-ui.js';

// Explicit loopback demo. Never load .env, the user's SQLite directory or hosted
// credentials. Fixtures exist in memory and reset when this process stops.
export async function startHandoffUiPreview({ port = 3214 } = {}) {
  const host = await build({ entryPoints: [fileURLToPath(new URL('../ui/preview-host.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', minify: true, target: 'es2022', logLevel: 'warning' });
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  const fixturePacket = { title: 'Conclave connector work', summary: 'Move the handoff workflow between chat apps.',
    objective: 'Save in one app and continue in another.', constraints: ['Ask before publishing.', 'Keep source labels visible.'],
    decisions: ['Use account-owned packets.'], open_questions: ['Which hosting option should we choose?'],
    next_steps: ['Test the UI in each real chat app.'], context: 'Handoffs contain explicit saved context.\n\nA hosting choice is still open.', source_app: 'Local demo' };
  const first = service.save({ packet: fixturePacket, request_id: 'demo-first' });
  service.save({ packet: { ...fixturePacket, summary: 'The packet browser is ready for local testing.', constraints: ['Ask before publishing.'] }, request_id: 'demo-second', handoff_id: first.handoff_id, expected_revision: 1 });
  for (let i = 0; i < 11; i++) service.save({ packet: { title: i === 0 ? 'Literal <img src=x onerror="window.parent.xss=true">' : `Demo handoff ${i + 1}`, summary: 'Synthetic preview data.', constraints: ['Keep this as a demo.'] }, request_id: `demo-${i}` });
  const mcp = createHandoffMcpServer(service, { write: false }), client = new Client({ name: 'local-ui-preview', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await mcp.connect(a); await client.connect(b);
  const resource = await client.readResource({ uri: handoffUiUri });
  const allowed = new Set(['find_handoffs', 'get_handoff', 'list_handoff_versions', 'compare_handoff_versions', 'open_handoff_library']);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const expected = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== expected || (req.headers.origin && req.headers.origin !== `http://${expected}`)) { res.writeHead(403); return res.end('Host or origin not allowed'); }
    if (req.url.startsWith('/?') || req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conclave UI preview</title><body style="font:14px system-ui;margin:16px"><p><strong>Local demo</strong> — synthetic packets only. This preview is not ChatGPT or Claude.</p><iframe title="Handoff browser" style="width:100%;height:780px;border:1px solid #888;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe><p id="messages" role="status"></p><script type="module" src="/host.js"></script></body></html>');
    }
    if (req.url === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(host.outputFiles[0].text); }
    if (req.url === '/view') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(resource.contents[0].text); }
    if (req.url === '/tool' && req.method === 'POST') {
      try {
        const chunks = []; let bytes = 0;
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 8192) { res.writeHead(413); return res.end(); } chunks.push(chunk); }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!allowed.has(input.name)) { res.writeHead(403); return res.end('Read-only demo'); }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(await client.callTool(input)));
      } catch { res.writeHead(400); return res.end('Demo operation failed'); }
    }
    res.writeHead(404); res.end('Not found');
  });
  try { await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); }); }
  catch (error) { await client.close(); await mcp.close(); store.close(); throw error; }
  return { server, service, demoId: first.handoff_id, url: `http://127.0.0.1:${server.address().port}`,
    close: async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); await client.close(); await mcp.close(); store.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preview = await startHandoffUiPreview(); console.log(`Synthetic Conclave UI preview: ${preview.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void preview.close().then(() => process.exit()); });
}
