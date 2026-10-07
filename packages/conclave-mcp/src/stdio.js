import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHandoffMcpServer } from './server.js';
import { openHandoffs } from './local.js';

const local = openHandoffs();
const server = createHandoffMcpServer(local.service);
let closing;
const close = () => closing ||= server.close().finally(() => local.close());
process.once('SIGINT', () => close().finally(() => process.exit(0)));
process.once('SIGTERM', () => close().finally(() => process.exit(0)));
process.stdin.once('end', close);
try { await server.connect(new StdioServerTransport()); }
catch { console.error('Conclave MCP could not start. Check its dependencies and data directory.'); local.close(); process.exitCode = 1; }
