import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const bundle = await build({ entryPoints: [fileURLToPath(new URL('packages/conclave-mcp/ui/app.js', root))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  legalComments: 'inline', logLevel: 'warning' });
const css = await transform(readFileSync(new URL('packages/conclave-mcp/ui/app.css', root), 'utf8'), { loader: 'css', minify: true });
const html = readFileSync(new URL('packages/conclave-mcp/ui/app.html', root), 'utf8')
  .replace('/* CONCLAVE_STYLES */', () => css.code.replaceAll('</style', '<\\/style'))
  .replace('/* CONCLAVE_SCRIPT */', () => bundle.outputFiles[0].text.replaceAll('</script', '<\\/script'));
const destination = new URL('src/resources/handoff-app.html', root);
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== html) throw Error('Handoff UI bundle is stale; run npm run mcp:ui:build');
  console.log('Handoff UI build matches its source');
} else { writeFileSync(destination, html); console.log(`Built self-contained handoff UI (${Buffer.byteLength(html)} bytes)`); }
