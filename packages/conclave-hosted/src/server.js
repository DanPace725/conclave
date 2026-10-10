import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createStandaloneApp } from './app.js';
import { createPool, verifyDatabase } from './database.js';

export async function startHostedServer({ env = process.env, pool = createPool(env.DATABASE_URL) } = {}) {
  let server;
  try {
    const port = Number(env.PORT || 3000);
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw Error('Invalid PORT');
    if (!env.CONCLAVE_MCP_ORIGIN || !env.CONCLAVE_SESSION_SECRET || !env.NEON_AUTH_BASE_URL || !env.CONCLAVE_ALLOWED_EMAILS)
      throw Error('Configure Conclave origin, session secret, Neon Auth and pilot account emails');
    const app = createStandaloneApp({ pool, origin: env.CONCLAVE_MCP_ORIGIN,
      secret: env.CONCLAVE_SESSION_SECRET, authBaseUrl: env.NEON_AUTH_BASE_URL, allowedEmails: env.CONCLAVE_ALLOWED_EMAILS,
      // The Railway public origin reaches this service through its edge proxy.
      // Local launches retain Express's direct-connection default.
      trustProxy: env.RAILWAY_SERVICE_ID ? 1 : false });
    await verifyDatabase(pool);
    server = createServer(app);
    server.headersTimeout = 15000; server.requestTimeout = 30000;
    await new Promise((ready, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', ready); });
    return { server, async close() {
      await new Promise(done => { server.close(done); server.closeIdleConnections(); }); await pool.end();
    } };
  } catch (error) { server?.close(); await pool.end(); throw error; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const running = await startHostedServer();
    console.log('Conclave hosted handoffs ready.');
    let closing = false;
    const shutdown = async () => {
      if (closing) return; closing = true;
      const timeout = setTimeout(() => process.exit(1), 25000); timeout.unref();
      await running.close(); clearTimeout(timeout);
    };
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  } catch { console.error('Conclave startup failed. Check deployment configuration and database migrations.'); process.exitCode = 1; }
}
