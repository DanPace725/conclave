import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

// Node fetch replaces Sec-Fetch-Mode with cors. Preserve explicit navigation
// metadata for public launch replays; use ordinary fetch for other checks.
function releaseFetch(url, options) {
  if (!options.headers?.['Sec-Fetch-Mode']) return fetch(url, options);
  return new Promise((done, reject) => {
    const request = new URL(url).protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, { method: options.method || 'GET', headers: options.headers, signal: options.signal }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => done(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    });
    req.on('error', reject); req.end();
  });
}

// Public release checks only. No environment files, credentials, sign-in emails,
// saved packets, OAuth grants or database mutations are used by this script.
export async function checkHostedDashboard(origin, { fetcher = releaseFetch } = {}) {
  const base = new URL(origin);
  if (base.origin !== origin || base.username || base.password ||
    (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)))
    throw Error('Supply a fixed HTTPS origin without a path or credentials');
  const results = [];
  async function check(label, path, status, verify = () => true, options = {}) {
    const response = await fetcher(base.origin + path, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });
    const passed = response.status === status && await verify(response);
    results.push({ check: label, status: response.status, passed });
  }
  await check('Database readiness', '/healthz', 200, async r => (await r.json()).status === 'ready');
  await check('Dashboard requires browser sign-in', '/dashboard', 303, r => r.headers.get('location') === '/'
    && r.headers.get('cache-control') === 'no-store' && /frame-ancestors 'none'/.test(r.headers.get('content-security-policy') || ''));
  for (const operation of ['find', 'get?handoff_id=conv_release_check', 'history?handoff_id=conv_release_check', 'compare?handoff_id=conv_release_check&from_revision=1'])
    await check(`Anonymous ${operation.split('?')[0]} denied`, '/dashboard/api/' + operation, 401,
      async r => r.headers.get('cache-control') === 'no-store' && (await r.json()).error === 'sign_in_required');
  await check('Dashboard writes refused', '/dashboard/api/find', 405, () => true, { method: 'POST' });
  await check('Foreign origin refused', '/dashboard/api/find', 403, () => true, { headers: { Origin: 'https://foreign.invalid' } });
  const navigation = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
  await check('Cross-site app launch reaches sign-in', '/dashboard/', 303, r => r.headers.get('location') === '/', { headers: navigation });
  await check('Worker-forwarded app launch reaches sign-in', '/dashboard/', 303, r => r.headers.get('location') === '/', { headers: { ...navigation, 'Sec-Fetch-Dest': 'empty' } });
  await check('Cross-site API navigation refused', '/dashboard/api/find', 403, () => true, { headers: navigation });
  await check('Cross-site shell fetch refused', '/dashboard/', 403, () => true, { headers: { ...navigation, 'Sec-Fetch-Mode': 'cors' } });
  await check('Cross-site frame navigation refused', '/dashboard/', 403, () => true, { headers: { ...navigation, 'Sec-Fetch-Dest': 'iframe' } });
  await check('App launch with foreign origin refused', '/dashboard/', 403, () => true, { headers: { ...navigation, Origin: 'https://foreign.invalid' } });
  await check('MCP still requires authorization', '/mcp', 401, r =>
    (r.headers.get('www-authenticate') || '').includes('/.well-known/oauth-protected-resource/mcp'), { method: 'POST' });
  await check('MCP read/write discovery preserved', '/.well-known/oauth-protected-resource/mcp', 200, async r => {
    const data = await r.json(); return data.resource === origin + '/mcp' &&
      ['handoffs:read', 'handoffs:write'].every(scope => data.scopes_supported?.includes(scope));
  });
  return { origin, passed: results.every(result => result.passed), checks: results };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkHostedDashboard(process.argv[2]);
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 1;
  } catch { console.error('Release checks could not complete. Check the origin and service readiness.'); process.exitCode = 1; }
}
