// Starts the Converse dev server against a copy of the live test store, with the hosted
// database deliberately unset so only the local SQLite copy is read.
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
process.env.CONCLAVE_DATA_DIR = new URL('../../.conclave/pr3-live-ui', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
process.env.PORT = process.env.PORT || '3311';
await import('../../../../converse/scripts/dev.js');
