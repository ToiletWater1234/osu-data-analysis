import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin } from '../functions/_shared/admin.js';
import { DEFAULT_CONTENT, validateContent, withDefaultLinks } from '../functions/_shared/content.js';
import { onRequestGet, onRequestPost, imageResponse } from '../functions/api/content.js';
import { upload, beatmap } from '../functions/api/admin.js';
import worker from '../worker.js';
import { add, remove, list } from '../functions/api/admin-users.js';

function env(id = 35851725) {
  const data = new Map();
  return { ADMIN_OSU_ID: '35851725', SESSIONS: { get: async () => ({ user: { id, username: 'MyAngelHyacine' }, expiresAt: Date.now() + 3600000, accessToken: 'test-only' }) },
    SITE_CONTENT: { get: async (key, type) => { const value = data.get(key)?.value; return type === 'json' && value ? JSON.parse(value) : value; },
      put: async (key, value, options) => data.set(key, { value, metadata: options?.metadata }), getWithMetadata: async key => data.get(key) } };
}
const request = (path, body) => new Request('https://site.test' + path, { method: 'POST', headers: { origin: 'https://site.test', cookie: 'osu_toolbox_session=test', 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('admin uses verified numeric ID, not display name or client flags', async () => {
  assert.equal(await isAdmin({ user: { id: 2, username: 'MyAngelHyacine' }, isAdmin: true }, env()), false);
  assert.equal(await isAdmin({ user: { id: 35851725, username: 'renamed' } }, env()), true);
  assert.equal(await isAdmin(null, env()), false);
  assert.equal(await isAdmin({ user: { id: 35851725 } }, {}), false);
  for (const handler of [onRequestPost, upload, beatmap]) assert.equal((await handler({ request: request('/api/admin/content', DEFAULT_CONTENT), env: env(2) })).status, 403);
});
test('delegated admin can edit carousel but only the owner can grant or revoke roles', async () => {
  const runtime = env(2);
  await runtime.SITE_CONTENT.put('administrators', JSON.stringify([{ id: 2, username: 'delegate' }]));
  assert.equal(await isAdmin({ user: { id: 2 } }, runtime), true);
  assert.equal((await onRequestPost({ request: request('/api/admin/content', DEFAULT_CONTENT), env: runtime })).status, 200);
  for (const handler of [add, remove, list]) assert.equal((await handler({ request: request('/api/admin/users', { query: '3', id: 2 }), env: runtime })).status, 403);
});
test('owner can add a verified player and remove that role, but cannot remove owner', async () => {
  const runtime = env();
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: 3, username: 'new-admin' });
  try {
    assert.equal((await add({ request: request('/api/admin/users', { query: 'new-admin' }), env: runtime })).status, 200);
    assert.equal(await isAdmin({ user: { id: 3 } }, runtime), true);
    assert.equal((await remove({ request: request('/api/admin/users/remove', { id: 3 }), env: runtime })).status, 200);
    assert.equal(await isAdmin({ user: { id: 3 } }, runtime), false);
    assert.equal((await remove({ request: request('/api/admin/users/remove', { id: 35851725 }), env: runtime })).status, 400);
  } finally { globalThis.fetch = original; }
});
test('admin saves public carousel title, ordering and image count persistently', async () => {
  const runtime = env();
  const content = { ...DEFAULT_CONTENT, title: '测试标题', intervalMs: 6000, slides: [...DEFAULT_CONTENT.slides].reverse().slice(0, 2) };
  const saved = await onRequestPost({ request: request('/api/admin/content', content), env: runtime });
  assert.equal(saved.status, 200);
  assert.deepEqual(await (await onRequestGet({ env: runtime })).json(), validateContent(content));
});
test('configuration rejects script URLs and invalid slide quantities', () => {
  assert.throws(() => validateContent({ ...DEFAULT_CONTENT, slides: [{ ...DEFAULT_CONTENT.slides[0], linkUrl: 'javascript:alert(1)' }] }), /超链接/);
  const uploaded = { title: '可点击的图片', source: 'upload', imageUrl: '/api/content/image/00000000-0000-0000-0000-000000000000', linkUrl: 'https://example.com/path' };
  assert.equal(validateContent({ ...DEFAULT_CONTENT, slides: [uploaded] }).slides[0].linkUrl, uploaded.linkUrl);
  assert.equal(withDefaultLinks(DEFAULT_CONTENT).slides[0].linkUrl, 'https://osu.ppy.sh/beatmapsets/2513401');
  assert.equal(withDefaultLinks({ ...DEFAULT_CONTENT, slides: [{ ...DEFAULT_CONTENT.slides[0], linkUrl: '' }] }).slides[0].linkUrl, '');
  assert.throws(() => validateContent({ ...DEFAULT_CONTENT, slides: [] }), /1–20/);
  assert.throws(() => validateContent({ ...DEFAULT_CONTENT, slides: Array(21).fill(DEFAULT_CONTENT.slides[0]) }), /1–20/);
  assert.throws(() => validateContent({ ...DEFAULT_CONTENT, slides: [{ source: 'upload', imageUrl: 'javascript:alert(1)' }] }), /上传/);
  assert.throws(() => validateContent({ ...DEFAULT_CONTENT, intervalMs: 1 }), /间隔/);
});
test('image uploads reject executable formats and serve recognized bytes without sniffing', async () => {
  const runtime = env();
  const make = body => new Request('https://site.test/api/admin/image', { method: 'POST', headers: { cookie: 'osu_toolbox_session=test' }, body });
  assert.equal((await upload({ request: make('<svg onload="alert(1)"/>'), env: runtime })).status, 400);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const response = await upload({ request: make(png), env: runtime });
  assert.equal(response.status, 200);
  const { imageUrl } = await response.json();
  const image = await imageResponse(new Request('https://site.test' + imageUrl), runtime);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
});
test('write routes enforce same-origin requests even for admin', async () => {
  const bad = new Request('https://site.test/api/admin/content', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' });
  assert.equal((await worker.fetch(bad, env())).status, 403);
});
test('beatmap resolver uses official API and does not fetch arbitrary URLs', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => { calls.push(String(url)); return Response.json({ id: 123, artist: 'Artist', title: 'Song' }); };
  try {
    const result = await beatmap({ request: request('/api/admin/beatmap', { query: 'https://osu.ppy.sh/beatmapsets/123#mania/456' }), env: env() });
    assert.equal(result.status, 200);
    const resolved = await result.json();
    assert.equal(resolved.imageUrl, 'https://assets.ppy.sh/beatmaps/123/covers/cover@2x.jpg');
    assert.equal(resolved.title, 'Artist — Song');
    assert.equal(resolved.linkUrl, 'https://osu.ppy.sh/beatmapsets/123#mania/456');
    const bad = await beatmap({ request: request('/api/admin/beatmap', { query: 'https://evil.test/beatmapsets/123' }), env: env() });
    assert.equal(bad.status, 400);
    assert.deepEqual(calls, ['https://osu.ppy.sh/api/v2/beatmapsets/123']);
  } finally { globalThis.fetch = original; }
});
