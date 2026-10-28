import test from 'node:test';
import assert from 'node:assert/strict';
import { getOsuSource as fetchSource } from '../functions/_shared/osu-files.js';
const getOsuSource = (env,id) => fetchSource(env,id,{status:'ranked'});
const text = 'osu file format v14\n[General]\nMode:3\n[HitObjects]\n';
test('graveyard and unknown charts never download or persist server-side',async()=>{
  const original=globalThis.fetch;let downloads=0,writes=0;const deleted=[];
  globalThis.fetch=async()=>{downloads++;return new Response(text);};
  try{for(const status of ['graveyard','pending','wip','unknown',undefined])await assert.rejects(fetchSource({OSU_FILES:{get:async()=>text,put:async()=>writes++,delete:async key=>deleted.push(key)}},'123',{status}),/本地/);
    assert.equal(downloads,0);assert.equal(writes,0);assert.equal(deleted.length,5);
  }finally{globalThis.fetch=original;}
});
test('missing graveyard entries do not spend delete operations',async()=>{
  let deleted=0;const store={get:async()=>null,delete:async()=>deleted++};
  await assert.rejects(fetchSource({OSU_FILES:store,CACHE:store},'789',{status:'graveyard'}),/本地/);assert.equal(deleted,0);
});
function store() {
  const data = new Map(), writes = [];
  return { writes, get: async key => data.get(key) || null, put: async (key, value, options) => { data.set(key, value); writes.push({ key, options }); } };
}
test('downloaded .osu persists without expiration and later requests reuse it', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(text); };
  try {
    const files = store();
    const first = await getOsuSource({ OSU_FILES: files }, '123');
    const second = await getOsuSource({ OSU_FILES: files }, '123');
    assert.equal(first.source, text);
    assert.equal(first.stored, true);
    assert.equal(second.cached, true);
    assert.equal(calls, 1);
    assert.equal(files.writes[0].options.expirationTtl, undefined);
  } finally { globalThis.fetch = original; }
});
test('existing seven-day cache migrates to persistent storage without another download', async () => {
  const files = store();
  const result = await getOsuSource({ OSU_FILES: files, CACHE: { get: async () => text } }, '123');
  assert.equal(result.cached, true);
  assert.equal(result.stored, true);
  assert.equal(await files.get('osu-file:v1:123'), text);
});
test('failed persistence does not prevent returning an available source', async () => {
  const original = console.warn;
  console.warn = () => {};
  try {
    const result = await getOsuSource({ OSU_FILES: { get: async () => null, put: async () => { throw new Error('quota'); } }, CACHE: { get: async () => text } }, '123');
    assert.equal(result.source, text);
    assert.equal(result.stored, false);
  } finally { console.warn = original; }
});
test('error pages and invalid IDs are never stored as .osu files', async () => {
  const original = globalThis.fetch;
  const files = store();
  globalThis.fetch = async () => new Response('<html>blocked</html>');
  try {
    await assert.rejects(getOsuSource({ OSU_FILES: files }, '123'), /有效/);
    await assert.rejects(getOsuSource({ OSU_FILES: files }, '../secret'), /ID/);
    assert.equal(files.writes.length, 0);
  } finally { globalThis.fetch = original; }
});
