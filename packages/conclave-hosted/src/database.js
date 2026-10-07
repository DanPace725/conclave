import pg from 'pg';

export function createPool(connectionString) {
  if (!connectionString) throw Error('Set DATABASE_URL for the separate Conclave database');
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000, statement_timeout: 15000 });
  pool.on('error', () => console.error('Conclave database connection interrupted.'));
  return pool;
}
export async function verifyDatabase(pool) {
  const { rows } = await pool.query("SELECT to_regclass('app.conversations') AS converse, to_regclass('app.provider_keys') AS keys, to_regclass('app.handoff_events') AS packets, to_regclass('app.mcp_records') AS records, to_regclass('app.mcp_locks') AS locks");
  const schema = rows[0];
  if (schema.converse || schema.keys) throw Error('Use a separate Conclave database, not the Converse database');
  if (!schema.packets || !schema.records || !schema.locks) throw Error('Apply the standalone Conclave migrations before starting');
}
