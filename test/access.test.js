import test from 'node:test';
import assert from 'node:assert/strict';
import { guard, identity, session, emailAllowed, identityRequired } from '../src/access.js';

const names = ['APP_PASSWORD', 'SESSION_SECRET', 'ALLOWED_EMAILS', 'KEY_ENCRYPTION_SECRET', 'VERCEL'];
function withEnv(values, run) {
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) if (values[name] === undefined) delete process.env[name]; else process.env[name] = values[name];
  try { return run(); } finally {
    for (const name of names) if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name];
  }
}
function attempt(cookie) {
  const res = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
  const req = { headers: cookie ? { cookie: 'converse_session=' + cookie } : {} };
  return { allowed: guard(req, res), status: res.status, error: res.body?.error, user: identity(req) };
}
const ada = { id: 'user-ada', email: 'Ada@Example.com' };

test('password sessions stay anonymous and keep working without SESSION_SECRET', () => {
  withEnv({ APP_PASSWORD: 'fixture-password' }, () => {
    assert.equal(identityRequired(), false);
    assert.deepEqual(attempt(session()), { allowed: true, status: undefined, error: undefined, user: null });
    assert.equal(attempt().status, 401);
    assert.equal(attempt('1.fake').allowed, false);
  });
});

test('identity sessions name an allowed user and reject everything else', () => {
  withEnv({ SESSION_SECRET: 'fixture-session-secret', ALLOWED_EMAILS: ' ada@example.com , grace@example.com ', APP_PASSWORD: 'fixture-password' }, () => {
    assert.equal(identityRequired(), true);
    const signedIn = attempt(session(ada));
    assert.equal(signedIn.allowed, true);
    assert.deepEqual(signedIn.user, { id: 'user-ada', email: 'Ada@Example.com' });
    const anonymous = attempt(session());
    assert.deepEqual([anonymous.allowed, anonymous.status, anonymous.error, anonymous.user], [false, 401, 'Sign in to continue.', null]);
    assert.equal(attempt(session({ id: 'user-eve', email: 'eve@example.com' })).allowed, false);
    const [expires, payload, signature] = session(ada).split('.');
    const forged = Buffer.from(JSON.stringify({ id: 'user-grace', email: 'grace@example.com' })).toString('base64url');
    assert.equal(attempt([expires, forged, signature].join('.')).allowed, false);
    assert.equal(attempt([expires, signature].join('.')).allowed, false);
    assert.equal(attempt(['1', payload, signature].join('.')).allowed, false);
    assert.equal(attempt([expires, payload, signature, 'extra'].join('.')).allowed, false);
  });
});

test('identity sessions end when the allowlist or secret changes', () => {
  const cookie = withEnv({ SESSION_SECRET: 'fixture-session-secret', ALLOWED_EMAILS: 'ada@example.com' }, () => session(ada));
  withEnv({ SESSION_SECRET: 'fixture-session-secret', ALLOWED_EMAILS: 'grace@example.com' }, () => assert.equal(attempt(cookie).allowed, false));
  withEnv({ SESSION_SECRET: 'fixture-session-secret' }, () => {
    assert.equal(attempt(cookie).allowed, false);
    assert.equal(emailAllowed(''), false);
  });
  withEnv({ SESSION_SECRET: 'rotated-session-secret', ALLOWED_EMAILS: 'ada@example.com' }, () => assert.equal(attempt(cookie).allowed, false));
  withEnv({ APP_PASSWORD: 'fixture-session-secret' }, () => assert.deepEqual(attempt(cookie).user, null));
});

test('"*" admits any signed-in account only while personal keys are on', () => {
  const eve = { id: 'user-eve', email: 'eve@elsewhere.example' };
  const secrets = { SESSION_SECRET: 'fixture-session-secret', KEY_ENCRYPTION_SECRET: 'fixture-key-encryption-secret-0123456789' };
  withEnv({ ...secrets, ALLOWED_EMAILS: 'ada@example.com, *' }, () => {
    assert.equal(emailAllowed('eve@elsewhere.example'), true);
    assert.equal(emailAllowed(''), false);
    assert.deepEqual(attempt(session(eve)).user, eve);
    assert.equal(attempt().status, 401);
    assert.equal(attempt(session()).allowed, false);
  });
  // Without personal keys the wildcard admits nobody: strangers never reach the deployment's keys.
  withEnv({ SESSION_SECRET: 'fixture-session-secret', ALLOWED_EMAILS: 'ada@example.com,*' }, () => {
    assert.equal(emailAllowed('eve@elsewhere.example'), false);
    assert.equal(attempt(session(eve)).allowed, false);
    assert.equal(attempt(session(ada)).allowed, true);
  });
  // An explicit list stays a list.
  withEnv({ ...secrets, ALLOWED_EMAILS: 'ada@example.com' }, () => assert.equal(attempt(session(eve)).allowed, false));
});
