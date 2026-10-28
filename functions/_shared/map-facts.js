import { osuFetch } from './auth.js';
import {readTransient,writeTransient} from './transient-cache.js';
const factsMemory=new Map();
const TTL=3600_000;
export async function rememberMapFacts(env,maps){
  for(const map of maps){if(!map?.id||!map.status)continue;factsMemory.delete(Number(map.id));factsMemory.set(Number(map.id),{id:Number(map.id),status:map.status,checksum:map.checksum||null,expiresAt:Date.now()+TTL});}
  while(factsMemory.size>2000)factsMemory.delete(factsMemory.keys().next().value);
}
export async function getMapFacts(env,session,ids,{contextKey}={}){
  // An analysis response contains official metadata for its full chart pool.
  // Reuse that one cache object on a cold isolate instead of 100 KV keys.
  if(ids.some(id=>!factsMemory.has(Number(id)))&&/^bp:v6:\d+:(osu|mania|taiko|fruits):(all|4k|7k):(base|extras)$/.test(contextKey||'')){
    const context=await readTransient(contextKey);
    if(context)await rememberMapFacts(env,[...(context.scores||[]),...(context.pinnedScores||[]),...(context.supplementalScores||[])].map(s=>s.beatmap));
  }
  const results=[],missing=[];
  for(const id of ids){const cached=factsMemory.get(Number(id));if(cached&&cached.expiresAt>Date.now()){const {expiresAt,...fact}=cached;results.push(fact);}else{factsMemory.delete(Number(id));missing.push(id);}}
  if(missing.length){
    const batchKey='map-facts:v2:'+missing.slice().sort((a,b)=>a-b).join(',');
    let maps=await readTransient(batchKey);
    if(!maps){const data=await osuFetch(env,session,'/beatmaps?'+missing.map(id=>'ids[]='+id).join('&'));maps=(data.beatmaps||[]).map(m=>({id:m.id,status:m.status,checksum:m.checksum||null}));await writeTransient(batchKey,maps,3600);}
    await rememberMapFacts(env,maps);results.push(...maps);
  }
  return results;
}
