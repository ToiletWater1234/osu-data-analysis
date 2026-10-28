import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/bp/analyze.js';
import {rememberMapFacts,getMapFacts} from '../functions/_shared/map-facts.js';
import {writeTransient} from '../functions/_shared/transient-cache.js';
test('B50 plus extra candidates and repeat BP requests use zero KV cache operations',async()=>{
  const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;let upstream=0;const cache=new Map();
  globalThis.caches={default:{match:async key=>cache.get(key.url)?.clone(),put:async(key,value)=>{cache.set(key.url,value.clone());}}};
  const forbidden=()=>{throw Error('Temporary data must not touch KV');};
  const env={CACHE:{get:forbidden,put:forbidden},SESSIONS:{get:async()=>({accessToken:'token',expiresAt:Date.now()+3600000})}};
  const scores=Array.from({length:100},(_,i)=>({accuracy:.99,beatmap:{id:90000+i,mode:'mania',cs:4,status:'ranked',checksum:'hash'+i},statistics:{great:100}}));
  globalThis.fetch=async url=>{upstream++;const path=new URL(url).pathname;return Response.json(path.endsWith('/best')?scores:path.endsWith('/pinned')||path.endsWith('/recent')?[]:{id:900,username:'CacheTest'});};
  const request=()=>new Request('https://site.test/api/bp/analyze',{method:'POST',headers:{cookie:'osu_toolbox_session=test'},body:JSON.stringify({userId:900,mode:'mania',keys:'4k',localLibrary:true})});
  try{
    const first=await(await onRequestPost({request:request(),env})).json();assert.equal(first.scores.length,50);assert.equal(upstream,4);
    const second=await(await onRequestPost({request:request(),env})).json();assert.equal(second.cached,true);assert.equal(upstream,4);
    const facts=await getMapFacts(env,{},[90001]);assert.equal(facts[0].status,'ranked');assert.equal(upstream,4);
    await rememberMapFacts(env,Array.from({length:1000},(_,i)=>({id:100000+i,status:'loved'})));
    assert.equal(cache.size,1);
  }finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
test('cold isolate can recover chart facts from one cached analysis without calling osu or KV',async()=>{
  const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;const objects=new Map();
  globalThis.caches={default:{match:async key=>objects.get(key.url)?.clone(),put:async(key,value)=>objects.set(key.url,value.clone())}};
  globalThis.fetch=async()=>{throw Error('must not call upstream');};
  try{await writeTransient('bp:v6:999:mania:all:extras',{scores:[{beatmap:{id:500000,status:'ranked',checksum:'new-hash'}}]},900);
    const facts=await getMapFacts({}, {}, [500000],{contextKey:'bp:v6:999:mania:all:extras'});assert.equal(facts[0].checksum,'new-hash');
  }finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
test('cache read/write failures do not turn a valid player analysis into an error',async()=>{
  const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;
  globalThis.caches={default:{match:async()=>{throw Error('unavailable');},put:async()=>{throw Error('unavailable');}}};
  globalThis.fetch=async url=>Response.json(new URL(url).pathname.includes('/scores/')?[]:{id:901,username:'Uncached'});
  try{const result=await onRequestPost({request:new Request('https://site.test/api/bp/analyze',{method:'POST',headers:{cookie:'osu_toolbox_session=test'},body:JSON.stringify({userId:901})}),env:{SESSIONS:{get:async()=>({accessToken:'token',expiresAt:Date.now()+3600000})},CACHE:{get:async()=>{throw Error('quota');},put:async()=>{throw Error('quota');}}}});assert.equal(result.status,200);assert.equal((await result.json()).user.username,'Uncached');}
  finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
