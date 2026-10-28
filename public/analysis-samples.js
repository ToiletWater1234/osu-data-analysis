import {isLocalBound,localUnknownIds,setLocalFacts,localScoreCandidates,findLocalSource,readLocalEntry} from './local-library.js';
import {createPpCalculator} from './pp-client.js';
export function sampleKey(score){
  return Number(score.beatmap.id)>0?'id:'+score.beatmap.id:'hash:'+score.beatmap.checksum;
}
export function mergeScoredSamples(base,extras){
  const selected=base.slice(0,50),baseKeys=new Set(selected.map(sampleKey)),best=new Map();
  for(const score of extras){
    if(!['loved','graveyard'].includes(score.beatmap.status)||!Number.isFinite(score.calculatedPp)||score.calculatedPp<0||baseKeys.has(sampleKey(score)))continue;
    const key=sampleKey(score),previous=best.get(key);
    if(!previous||score.calculatedPp>previous.calculatedPp)best.set(key,score);
  }
  const extra=[...best.values()].sort((a,b)=>b.calculatedPp-a.calculatedPp||sampleKey(a).localeCompare(sampleKey(b))).slice(0,50);
  return {scores:[...selected,...extra],localCount:extra.length};
}
export async function collectAnalysisSamples(data,api,progress=()=>{}){
  if(!isLocalBound()||!data.localExtrasEnabled)return {scores:data.scores.slice(0,50),localCount:0,notes:[]};
  const notes=[],unknown=localUnknownIds(data.user,data.keys);
  for(let i=0;i<unknown.length;i+=50){
    progress(`正在确认本地成绩的谱面状态 ${Math.min(i+50,unknown.length)} / ${unknown.length}…`);
    try{const facts=await api('/api/beatmaps/facts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:unknown.slice(i,i+50)})});setLocalFacts(facts.beatmaps);}
    catch{notes.push('部分谱面状态无法确认，已跳过这些本地成绩。');break;}
    if(i+50<unknown.length)await new Promise(resolve=>setTimeout(resolve,1100));
  }
  const extras=[];
  for(const score of data.supplementalScores||[]){
    if(!['loved','graveyard'].includes(score.beatmap.status))continue;
    if(data.keys!=='all'&&score.beatmap.keys!==Number(data.keys.replace('k','')))continue;
    extras.push({...score,localSupplement:true});
  }
  for(const record of localScoreCandidates(data.user,data.keys)){
    const e=record.entry;
    if(!e.statusVerified||!['loved','graveyard'].includes(e.status)||record.hitCount<e.noteCount)continue;
    extras.push({accuracy:record.accuracy,statistics:record.statistics,client:'stable',mods:record.mods,modDetails:[],localEntry:e,localSupplement:true,beatmap:{id:e.id,checksum:e.hash,status:e.status,keys:e.keys},source:'scores.db'});
  }
  const calculator=createPpCalculator(),ranked=[],baseKeys=new Set(data.scores.slice(0,50).map(sampleKey));let failed=0,completed=0;
  try{
    for(const score of extras){
      if(baseKeys.has(sampleKey(score)))continue;
      progress(`正在本地复算 Loved / 坟图成绩 PP ${++completed} / ${extras.length}…`);
      try{
        const source=score.localEntry?await readLocalEntry(score.localEntry):(await findLocalSource(score.beatmap.id,score.beatmap.checksum))?.source;
        if(!source)continue;
        const result=await calculator.calculate(source,score);
        ranked.push({...score,calculatedPp:result.pp,ppEngine:result.engine});
      }catch{failed++;}
    }
  }finally{calculator.dispose();}
  const {scores,localCount}=mergeScoredSamples(data.scores,ranked);
  if(failed)notes.push(`${failed} 条候选成绩无法复算 PP，已跳过。`);
  if(!localCount)notes.push('未匹配到可计算 PP 的 Loved / 坟图实际成绩。');
  return {scores,localCount,notes};
}
