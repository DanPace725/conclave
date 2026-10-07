import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { startServer } from '../src/server.js';
import { session } from '../src/access.js';
import { CredentialStore, requestCredentials, createCredentialHandler, ownKeysEnabled, keyProviders } from '../src/credentials.js';
import { OpenAIProvider, AnthropicProvider, JevProvider } from '../src/provider.js';
import { OpenAIEmbeddingProvider } from '../src/embeddings.js';

const names = ['APP_PASSWORD', 'SESSION_SECRET', 'ALLOWED_EMAILS', 'KEY_ENCRYPTION_SECRET', 'SHARED_KEY_EMAILS', 'CONCLAVE_EMBEDDINGS',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'JEV_API_KEY', 'TYPESAFE_API_KEY'];
const signedIn = { SESSION_SECRET: 'fixture-session-secret', ALLOWED_EMAILS: 'ada@example.com,grace@example.com,owner@example.com',
  KEY_ENCRYPTION_SECRET: 'fixture-key-encryption-secret-0123456789', CONCLAVE_EMBEDDINGS: 'off',
  // The deployment's own keys: nobody off SHARED_KEY_EMAILS may spend them. Every
  // name is set so a Windows machine's saved user keys are never looked up.
  OPENAI_API_KEY: 'sk-deployment-openai', ANTHROPIC_API_KEY: 'sk-deployment-anthropic', GEMINI_API_KEY: 'deployment-gemini',
  GOOGLE_API_KEY: 'deployment-google', TYPESAFE_API_KEY: 'deployment-jev', JEV_API_KEY: 'deployment-jev' };
const ada = { id: 'user-ada', email: 'ada@example.com' }, grace = { id: 'user-grace', email: 'grace@example.com' };
const owner = { id: 'user-owner', email: 'owner@example.com' };

async function withDatabase(values, run) {
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) if (values[name] === undefined) delete process.env[name]; else process.env[name] = values[name];
  const client = new PGlite({ extensions: { vector } });
  const migrations = new URL('../drizzle/', import.meta.url);
  try {
    for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort())
      for (const statement of readFileSync(new URL(file, migrations), 'utf8').split('--> statement-breakpoint'))
        if (statement.trim()) await client.exec(statement);
    return await run(drizzle(client, { schema }), client);
  } finally {
    await client.close();
    for (const name of names) if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name];
  }
}

test('saved keys are encrypted, bound to their owner and provider, and unreadable under another secret', async () => {
  await withDatabase(signedIn, async (db, client) => {
    const store = new CredentialStore(db);
    await store.save(ada.id, 'openai', 'sk-ada-openai-key-1234');
    await store.save(ada.id, 'openai', 'sk-ada-openai-key-5678');
    await store.save(grace.id, 'anthropic', 'sk-ant-grace-key-9999');
    assert.deepEqual(await store.keys(ada.id), { openai: 'sk-ada-openai-key-5678' });
    assert.deepEqual(await store.keys(grace.id), { anthropic: 'sk-ant-grace-key-9999' });
    assert.deepEqual(await store.keys(null), {});
    const rows = (await client.query('SELECT owner_id, provider, secret, hint FROM app.provider_keys ORDER BY owner_id')).rows;
    assert.deepEqual(rows.map(row => [row.owner_id, row.provider, row.hint]), [['user-ada', 'openai', '5678'], ['user-grace', 'anthropic', '9999']]);
    assert.doesNotMatch(JSON.stringify(rows), /sk-ada|sk-ant-grace/);

    // A ciphertext copied onto another user's row does not decrypt there.
    await client.query("INSERT INTO app.provider_keys (owner_id, provider, secret, hint) SELECT 'user-eve', provider, secret, hint FROM app.provider_keys WHERE owner_id = 'user-ada'");
    assert.deepEqual(await store.keys('user-eve'), {});

    await assert.rejects(store.save(ada.id, 'unknown', 'sk-ada-openai-key-1234'), /Unknown provider/);
    await assert.rejects(store.save(ada.id, 'openai', 'short'), /exactly as the provider shows it/);
    await assert.rejects(store.save(ada.id, 'openai', 'sk-with a space-in-it'), /exactly as the provider shows it/);

    process.env.KEY_ENCRYPTION_SECRET = 'a-different-key-encryption-secret-0123456789';
    assert.deepEqual(await store.keys(ada.id), {});
    process.env.KEY_ENCRYPTION_SECRET = 'too-short';
    await assert.rejects(store.keys(ada.id), /at least 32 characters/);
    process.env.KEY_ENCRYPTION_SECRET = signedIn.KEY_ENCRYPTION_SECRET;
    await store.remove(ada.id, 'openai');
    assert.deepEqual(await store.keys(ada.id), {});
  });
});

test('a request spends only its own keys unless the user is allowed the shared ones', async () => {
  await withDatabase({ ...signedIn, SHARED_KEY_EMAILS: ' Owner@Example.com ' }, async db => {
    const database = () => db;
    await new CredentialStore(db).save(ada.id, 'openai', 'sk-ada-openai-key-1234');
    await new CredentialStore(db).save(owner.id, 'anthropic', 'sk-ant-owner-own-key');
    assert.equal(ownKeysEnabled(), true);
    assert.deepEqual(await requestCredentials(database, ada), { openai: 'sk-ada-openai-key-1234' });
    assert.deepEqual(await requestCredentials(database, grace), {});
    // Fail closed: no user, no keys.
    assert.deepEqual(await requestCredentials(database, null), {});
    // The allowed address keeps the deployment's keys; an own key still wins.
    assert.deepEqual(await requestCredentials(database, owner),
      { anthropic: 'sk-ant-owner-own-key', openai: 'sk-deployment-openai', gemini: 'deployment-gemini', jev: 'deployment-jev' });

    // Without the secret, or without sign-in, everyone uses the environment as before.
    delete process.env.KEY_ENCRYPTION_SECRET;
    assert.equal(await requestCredentials(() => assert.fail('no database read expected'), ada), undefined);
    process.env.KEY_ENCRYPTION_SECRET = signedIn.KEY_ENCRYPTION_SECRET;
    delete process.env.SESSION_SECRET;
    assert.equal(ownKeysEnabled(), false);
    assert.equal(await requestCredentials(() => assert.fail('no database read expected'), null), undefined);
  });
});

test('an explicit own key never falls back to the environment key', async () => {
  await withDatabase(signedIn, async () => {
    for (const [Provider, label] of [[OpenAIProvider, 'OpenAI'], [AnthropicProvider, 'Anthropic'], [JevProvider, 'Jev'], [OpenAIEmbeddingProvider, 'OpenAI']]) {
      assert.throws(() => new Provider({ apiKey: null }), new RegExp(`No ${label} API key is saved for your account`));
      assert.equal(new Provider({ apiKey: 'own-key-for-fixture' }).key, 'own-key-for-fixture');
    }
    assert.equal(new OpenAIProvider().key, 'sk-deployment-openai');
    assert.equal(new AnthropicProvider({}).key, 'sk-deployment-anthropic');
  });
});

test('the key endpoint checks a key with its provider, stores it, and returns only its last four characters', async () => {
  await withDatabase({ ...signedIn, SHARED_KEY_EMAILS: 'owner@example.com' }, async (db, client) => {
    const checks = [];
    let outcome = 200;
    const handler = createCredentialHandler({ database: () => db, fetchImpl: async (url, options) => {
      checks.push({ url, headers: options.headers });
      if (outcome === 'offline') throw Error('socket hang up for ' + JSON.stringify(options.headers));
      return new Response('{}', { status: outcome });
    } });
    const call = async (user, method = 'GET', input) => {
      const res = { writeHead(status) { this.status = status; }, end(text) { this.text = text; } };
      await handler({ method, headers: { ...(user ? { cookie: 'converse_session=' + session(user) } : {}), 'content-type': 'application/json' }, body: input }, res);
      return { status: res.status, body: JSON.parse(res.text), text: res.text };
    };
    const status = body => Object.fromEntries(body.providers.map(item => [item.id, item.source]));

    assert.equal((await call(null)).status, 401);
    const empty = await call(ada);
    assert.equal(empty.body.enabled, true);
    assert.deepEqual(empty.body.providers.map(item => item.id), Object.keys(keyProviders));
    assert.deepEqual(status(empty.body), { openai: null, anthropic: null, gemini: null, jev: null });
    assert.deepEqual(status((await call(owner)).body), { openai: 'shared', anthropic: 'shared', gemini: 'shared', jev: 'shared' });

    outcome = 401;
    const refused = await call(ada, 'POST', { action: 'save', provider: 'openai', key: 'sk-ada-refused-key-0000' });
    assert.deepEqual([refused.status, refused.body.error], [400, 'OpenAI did not accept this key.']);
    outcome = 'offline';
    const offline = await call(ada, 'POST', { action: 'save', provider: 'openai', key: 'sk-ada-refused-key-0000' });
    assert.deepEqual([offline.status, offline.body.error], [502, 'Could not reach OpenAI to check the key. Try again.']);
    outcome = 500;
    assert.equal((await call(ada, 'POST', { action: 'save', provider: 'openai', key: 'sk-ada-refused-key-0000' })).status, 502);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM app.provider_keys')).rows[0].n, 0);

    outcome = 200;
    checks.length = 0;
    const saved = await call(ada, 'POST', { action: 'save', provider: 'anthropic', key: '  sk-ant-ada-key-4321  ' });
    assert.equal(saved.status, 200);
    assert.deepEqual(checks, [{ url: 'https://api.anthropic.com/v1/models?limit=1', headers: { 'x-api-key': 'sk-ant-ada-key-4321', 'anthropic-version': '2023-06-01' } }]);
    const row = saved.body.providers.find(item => item.id === 'anthropic');
    assert.deepEqual([row.source, row.hint], ['own', '4321']);
    assert.doesNotMatch(saved.text, /sk-ant-ada/);
    assert.doesNotMatch((await call(ada)).text, /sk-ant-ada/);
    // The Gemini check carries the key in a header, never in the address.
    await call(ada, 'POST', { action: 'save', provider: 'gemini', key: 'gemini-ada-key-7777' });
    assert.equal(checks.at(-1).url, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
    assert.deepEqual(status((await call(grace)).body), { openai: null, anthropic: null, gemini: null, jev: null });

    for (const [input, message] of [[{ action: 'save', provider: 'mystery', key: 'sk-ada-key-12345678' }, /Unknown provider/],
      [{ action: 'save', provider: 'openai', key: '' }, /exactly as the provider shows it/], [{ action: 'rotate', provider: 'openai' }, /Unsupported key operation/]])
      assert.match((await call(ada, 'POST', input)).body.error, message);

    process.env.KEY_ENCRYPTION_SECRET = 'a-different-key-encryption-secret-0123456789';
    const rotated = (await call(ada)).body.providers.find(item => item.id === 'anthropic');
    assert.deepEqual([rotated.source, rotated.unreadable, rotated.hint], [null, true, '4321']);
    process.env.KEY_ENCRYPTION_SECRET = signedIn.KEY_ENCRYPTION_SECRET;

    const removed = await call(ada, 'POST', { action: 'remove', provider: 'anthropic' });
    assert.deepEqual(status(removed.body), { openai: null, anthropic: null, gemini: 'own', jev: null });

    delete process.env.KEY_ENCRYPTION_SECRET;
    assert.deepEqual((await call(ada)).body, { enabled: false, providers: [] });
  });
});

test('hosted Context spends the signed-in user\'s saved key and never the deployment key', async () => {
  await withDatabase(signedIn, async db => {
    const realFetch = globalThis.fetch, spent = [];
    let server;
    globalThis.fetch = async (url, options = {}) => {
      if (!String(url).startsWith('https://')) return realFetch(url, options);
      spent.push({ url: String(url), authorization: options.headers?.Authorization });
      return new Response(JSON.stringify({ id: 'resp_fixture', model: 'fixture', status: 'completed',
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Paid for by Ada.' }] }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
      await new CredentialStore(db).save(ada.id, 'openai', 'sk-ada-openai-key-1234');
      server = await startServer({ port: 0, database: () => db });
      const base = `http://127.0.0.1:${server.address().port}/api/`;
      const as = user => {
        const headers = { cookie: 'converse_session=' + session(user), 'content-type': 'application/json' };
        return { get: async path => (await realFetch(base + path, { headers })).json(),
          post: async input => { const response = await realFetch(base + 'conclave', { method: 'POST', headers, body: JSON.stringify(input) }); return { status: response.status, body: await response.json() }; } };
      };
      assert.deepEqual((await as(ada).get('conclave?action=status')).credentials, { openai: true, anthropic: false, jev: false });
      assert.deepEqual((await as(grace).get('conclave?action=status')).credentials, { openai: false, anthropic: false, jev: false });
      assert.equal((await as(ada).get('keys')).providers.find(item => item.id === 'openai').source, 'own');

      const adas = (await as(ada).post({ action: 'create', title: "Ada's notes" })).body.conversation_id;
      const answered = await as(ada).post({ action: 'ask', conversation_id: adas, message_id: 'msg_ada', content: 'Hello', settings: { provider: 'openai', model: 'fixture', jev: false } });
      assert.equal(answered.status, 200, JSON.stringify(answered.body));
      assert.equal(answered.body.messages.at(-1).content, 'Paid for by Ada.');
      assert.ok(spent.length);
      assert.deepEqual([...new Set(spent.map(call => call.authorization))], ['Bearer sk-ada-openai-key-1234']);
      // The saved audit and its export hold request payloads, never the key.
      const record = JSON.stringify(await as(ada).get(`conclave?action=download&conversation=${adas}`));
      assert.match(record, /Paid for by Ada\./);
      assert.doesNotMatch(record, /sk-ada-openai-key-1234|sk-deployment/);

      // Grace saved nothing: her request reaches no provider, least of all on the deployment's key.
      spent.length = 0;
      const graces = (await as(grace).post({ action: 'create', title: "Grace's notes" })).body.conversation_id;
      const refused = await as(grace).post({ action: 'ask', conversation_id: graces, message_id: 'msg_grace', content: 'Hello', settings: { provider: 'openai', model: 'fixture', jev: false } });
      assert.match(refused.body.error, /No OpenAI API key is saved for your account/);
      assert.deepEqual(spent, []);
      // Ada has no Anthropic key either; her OpenAI key is not sent to Anthropic.
      const claude = await as(ada).post({ action: 'ask', conversation_id: adas, message_id: 'msg_ada_2', content: 'Hello', settings: { provider: 'anthropic', model: 'claude-fixture', jev: false } });
      assert.match(claude.body.error, /No Anthropic API key is saved for your account/);
      assert.deepEqual(spent, []);
    } finally {
      globalThis.fetch = realFetch;
      server?.close();
    }
  });
});
