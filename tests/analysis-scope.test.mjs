import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as analyze} from '../functions/api/bp/analyze.js';
import {onRequestPost as source} from '../functions/api/beatmaps/analyze.js';
const env={SESSIONS:{get:async()=>({accessToken:'test',expiresAt:Date.now()+3_600_000})}};
const request=(path,body)=>new Request('https://site.test'+path,{method:'POST',headers:{cookie:'osu_toolbox_session=test','content-type':'application/json'},body:JSON.stringify(body)});
test('bound and unbound requests both use B50; binding only enables scored Loved/graveyard candidates',async()=>{
  const original=globalThis.fetch,paths=[];
  const scores=Array.from({length:100},(_,i)=>({id:i+1,accuracy:.99,beatmap:{id:i+1,mode:'mania',cs:4,status:'ranked'},statistics:{great:100}}));
  globalThis.fetch=async url=>{const path=new URL(url).pathname;paths.push(path);let data;
    if(path.endsWith('/best'))data=scores;
    else if(path.endsWith('/recent'))data=[{...scores[0],id:200,beatmap:{...scores[0].beatmap,id:200,status:'graveyard'}}];
    else if(path.endsWith('/pinned'))data=[];
    else data={id:1,username:'Alice',previous_usernames:['OldAlice']};
    return Response.json(data);
  };
  try{
    const a=await(await analyze({request:request('/api/bp/analyze',{userId:1,mode:'mania',keys:'4k'}),env})).json();assert.equal(a.scores.length,50);assert.equal(a.supplementalScores.length,0);assert.deepEqual(a.user.previousUsernames,['OldAlice']);assert.ok(!paths.some(p=>p.endsWith('/recent')));
    const b=await(await analyze({request:request('/api/bp/analyze',{userId:1,mode:'mania',keys:'4k',localLibrary:true}),env})).json();assert.equal(b.scores.length,50);assert.equal(b.analysisLimit,50);assert.equal(b.localExtrasEnabled,true);assert.equal(b.supplementalScores.length,1);assert.equal(b.supplementalScores[0].beatmap.status,'graveyard');assert.ok(paths.some(p=>p.endsWith('/recent')));
  }finally{globalThis.fetch=original;}
});
test('official identity is fetched by requested numeric ID and client-supplied aliases cannot replace it',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{const parsed=new URL(url);if(parsed.pathname.includes('/scores/'))return Response.json([]);assert.equal(parsed.pathname,'/api/v2/users/12/mania');assert.equal(parsed.searchParams.get('key'),'id');return Response.json({id:12,username:'Current',previous_usernames:['Former']});};
  try{const response=await analyze({request:request('/api/bp/analyze',{userId:12,localLibrary:true,previousUsernames:['Injected']}),env});const data=await response.json();assert.equal(response.status,200);assert.equal(data.user.id,12);assert.deepEqual(data.user.previousUsernames,['Former']);}
  finally{globalThis.fetch=original;}
});
test('API source route verifies graveyard status before any source download',async()=>{
  const original=globalThis.fetch;const paths=[];
  globalThis.fetch=async url=>{paths.push(new URL(url).pathname);return Response.json({beatmaps:[{id:123,status:'graveyard',checksum:'abc'}]});};
  try{const result=await source({request:request('/api/beatmaps/analyze',{id:123}),env});assert.equal(result.status,412);assert.deepEqual(paths,['/api/v2/beatmaps']);assert.match((await result.json()).error,/本地/);}
  finally{globalThis.fetch=original;}
});
