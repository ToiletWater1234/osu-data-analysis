import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as login } from '../functions/api/auth/login.js';
import { onRequestGet as callback } from '../functions/api/auth/callback.js';
import { onRequestGet as session } from '../functions/api/auth/session.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';

function environment() {
  const data = new Map();
  return { OSU_CLIENT_ID: '123', OSU_CLIENT_SECRET: 'test-secret', SESSIONS: {
    async put(k, v) { data.set(k, v); },
    async get(k, type) { const v = data.get(k); return v ? type === 'json' ? JSON.parse(v) : v : null; },
    async delete(k) { data.delete(k); },
  }};
}

test('OAuth state is bound to the browser and tokens never enter session JSON', async () => {
  const env = environment();
  const response = await login({ request: new Request('https://site.test/api/auth/login'), env });
  const authorize = new URL(response.headers.get('location'));
  assert.equal(authorize.origin, 'https://osu.ppy.sh');
  assert.equal(authorize.searchParams.get('redirect_uri'), 'https://site.test/api/auth/callback');
  const state = authorize.searchParams.get('state');
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  const url = `https://site.test/api/auth/callback?code=mock-code&state=${state}`;
  const rejected = await callback({ request: new Request(url), env });
  assert.match(rejected.headers.get('location'), /login=error/);
  assert.equal(JSON.parse(await env.SESSIONS.get(`oauth-state:${state}`)).returnTo, '/');
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => Response.json(String(url).includes('/oauth/token')
    ? { access_token: 'access-test', refresh_token: 'refresh-test', expires_in: 3600 }
    : { id: 1, username: 'player', avatar_url: 'https://a.ppy.sh/1', country_code: 'CN' });
  try {
    const accepted = await callback({ request: new Request(url, { headers: { cookie } }), env });
    assert.equal(accepted.headers.get('location'), '/?login=success');
    const sessionCookie = accepted.headers.get('set-cookie').split(';')[0];
    const request = new Request('https://site.test/api/auth/session', { headers: { cookie: sessionCookie } });
    const result = await session({ request, env });
    const text = await result.text();
    assert.equal(JSON.parse(text).authenticated, true);
    assert.ok(!text.includes('access-test') && !text.includes('refresh-test'));
    const replay = await callback({ request: new Request(url, { headers: { cookie } }), env });
    assert.match(replay.headers.get('location'), /login=error/);
    await logout({ request, env });
    assert.equal((await (await session({ request, env })).json()).authenticated, false);
  } finally { globalThis.fetch = original; }
});

test('unconfigured login returns a useful page notice', async () => {
  const response = await login({ request: new Request('https://site.test/api/auth/login'), env: {} });
  assert.match(response.headers.get('location'), /login=error/);
});

test('OAuth returns to the selected tool page and rejects external return URLs', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => Response.json(String(url).includes('/oauth/token')
    ? { access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600 }
    : { id: 1, username: 'player' });
  try {
    for (const [returnTo, expected] of [['/bp/', '/bp/'], ['/compare/', '/compare/'], ['/beatmaps/', '/beatmaps/'], ['https://evil.test', '/'], ['//evil.test', '/']]) {
      const env = environment();
      const response = await login({ request: new Request('https://site.test/api/auth/login?returnTo=' + encodeURIComponent(returnTo)), env });
      const state = new URL(response.headers.get('location')).searchParams.get('state');
      const cookie = response.headers.get('set-cookie').split(';')[0];
      const callbackRequest = new Request(`https://site.test/api/auth/callback?code=test&state=${state}`, { headers: { cookie } });
      const result = await callback({ request: callbackRequest, env });
      assert.equal(result.headers.get('location'), `${expected}?login=success`);
    }
  } finally { globalThis.fetch = original; }
});
