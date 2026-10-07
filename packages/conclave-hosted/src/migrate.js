import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPool } from './database.js';

export async function migrateHosted(pool) {
  const sql = await readFile(new URL('../migrations/0001_handoffs.sql', import.meta.url), 'utf8');
  const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query("SELECT to_regclass('app.conversations') AS converse, to_regclass('app.provider_keys') AS keys");
    if (rows[0].converse || rows[0].keys) throw Error('Refusing to migrate Converse: use a separate Conclave database');
    await client.query('CREATE SCHEMA IF NOT EXISTS conclave_hosted');
    await client.query('CREATE TABLE IF NOT EXISTS conclave_hosted.migrations (version integer PRIMARY KEY, checksum text)');
    await client.query('INSERT INTO conclave_hosted.migrations(version) VALUES (1) ON CONFLICT DO NOTHING');
    const prior = await client.query('SELECT checksum FROM conclave_hosted.migrations WHERE version=1 FOR UPDATE');
    if (prior.rows[0].checksum && prior.rows[0].checksum !== checksum) throw Error('Standalone migration checksum differs');
    if (!prior.rows[0].checksum) {
      await client.query(sql);
      await client.query('UPDATE conclave_hosted.migrations SET checksum=$1 WHERE version=1', [checksum]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL_UNPOOLED || new URL(process.env.DATABASE_URL_UNPOOLED).hostname.includes('-pooler'))
    throw Error('Set DATABASE_URL_UNPOOLED to a direct connection for the separate Conclave database');
  const pool = createPool(process.env.DATABASE_URL_UNPOOLED);
  try { await migrateHosted(pool); console.log('Standalone Conclave migrations applied.'); }
  catch { console.error('Standalone migration failed. Check the separate database and migration history.'); process.exitCode = 1; }
  finally { await pool.end(); }
}
