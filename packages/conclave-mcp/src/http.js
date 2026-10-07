import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createHandoffMcpServer } from './server.js';
import { openHandoffs } from './local.js';

const digest = value => createHash('sha256').update(value).digest();
const json = (res, status, message) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: message }));
};

// Development transport: one private local installation, never an anonymous
// public endpoint. Hosted multi-user OAuth and grants are a separate next step.
export async function startHandoffHttpServer({ service, token, port = 3213 }) {
  if (typeof token !== 'string' || token.length < 32) throw Error('Set CONCLAVE_MCP_TOKEN to a random secret of at least 32 characters');
  const expected = digest(`Bearer ${token}`);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const address = server.address(), hosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    if (!hosts.includes(req.headers.host) || (req.headers.origin && !hosts.map(host => `http://${host}`).includes(req.headers.origin)))
      return json(res, 403, 'Origin or host not allowed');
    if (!timingSafeEqual(digest(req.headers.authorization || ''), expected)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return json(res, 401, 'Authentication required');
    }
    if (req.url !== '/mcp') return json(res, 404, 'Not found');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, 'Use POST'); }
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return json(res, 415, 'JSON required');
    let parsed;
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 100000) { json(res, 413, 'Request too large'); return; }
        chunks.push(chunk);
      }
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json(res, 400, 'One JSON-RPC object required');
    } catch { if (!res.writableEnded) json(res, 400, 'Invalid JSON'); return; }
    const mcp = createHandoffMcpServer(service);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    const cleanup = () => { void mcp.close().catch(() => {}); };
    res.once('close', cleanup);
    try { await mcp.connect(transport); await transport.handleRequest(req, res, parsed); }
    catch { if (!res.headersSent) json(res, 500, 'Conclave could not complete this request'); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolveReady(); });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let local;
  try {
    // Validate configuration before touching the private database.
    const token = process.env.CONCLAVE_MCP_TOKEN;
    if (!token || token.length < 32) throw Error('Set CONCLAVE_MCP_TOKEN to a random secret of at least 32 characters');
    const port = Number(process.env.CONCLAVE_MCP_PORT || 3213);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw Error('Invalid CONCLAVE_MCP_PORT');
    local = openHandoffs();
    const server = await startHandoffHttpServer({ service: local.service, token, port });
    console.error(`Conclave MCP listening at http://127.0.0.1:${server.address().port}/mcp (private local development)`);
    const close = () => server.close(() => { local.close(); process.exit(0); });
    process.once('SIGINT', close); process.once('SIGTERM', close);
  } catch (error) { local?.close(); console.error(error.message); process.exitCode = 1; }
}
