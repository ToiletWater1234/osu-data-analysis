import {tableFor, labelFor} from './vendor/manialivedan/js/app/dan.js';
import {verifyAccuracyBasis} from './mania-segment-profile.js';
import {maniaName} from './mania-labels.js';

export const WEIGHTED_VERSION='segments-v2';
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const standard=(keys,kind)=>kind==='RC'?.96:keys===4?.97:keys===7?.95:.96;
const weightedMean=items=>items.reduce((s,p)=>s+p.value*p.weight,0)/items.reduce((s,p)=>s+p.weight,0);

export function stepForStar(star,keys,kind) {
  const table=tableFor(keys,kind);
  if(!table.length||!Number.isFinite(star)||star<=0)return null;
  const index=table.findIndex(([lo,hi])=>star>=lo&&star<=hi);
  if(index<0)return star<table[0][0]?-1:table.length-1;
  const [lo,hi]=table[index];
  return index+clamp((star-(lo+hi)/2)/(hi-lo),-.5,.5);
}
export function stepForLabel(label,keys,kind) {
  const clean=s=>String(s||'').replace(/[<>]/g,'').replaceAll('low/mid','mid/low').replace(/\s+/g,' ').trim().toLowerCase();
  const index=tableFor(keys,kind).findIndex(([, ,name])=>clean(name)===clean(label));
  return index<0?null:index;
}
export function labelAtStep(step,keys,kind) {
  const table=tableFor(keys,kind);
  if(!table.length||!Number.isFinite(step))return '没有可用成绩';
  if(step<-.5)return `< ${table[0][2]}`;
  return table[clamp(Math.round(step),0,table.length-1)][2];
}

// Five adjacent table entries are one course level. Coverage is an independent
// feature weight, never a partition of the chart: overlapping skills may sum >1.
export function contributionAdjustments(accuracy,share,keys,kind) {
  return {accuracyPenalty:Math.max(0,(standard(keys,kind)-accuracy)*100),
    coveragePenalty:share>=.5?0:2*Math.log2(.5/Math.max(share,.000001))};
}
function quantile(items,q) {
  const ordered=items.slice().sort((a,b)=>a.value-b.value);
  const target=ordered.reduce((s,p)=>s+p.weight,0)*q;
  let sum=0;
  for(const p of ordered){sum+=p.weight;if(sum>=target)return p.value;}
  return ordered.at(-1)?.value??null;
}
function qualityOf(a) {
  if(!Number.isFinite(a.accuracy)||a.accuracy<=0||a.accuracy>1||!(a.totalStableUnits>0))return null;
  const stats=a.statistics;
  if(stats){
    const counts=['perfect','great','good','ok','meh','miss'].map(k=>stats[k]??0);
    if(counts.some(n=>!Number.isSafeInteger(n)||n<0)||counts.reduce((s,n)=>s+n,0)<a.totalStableUnits)return null;
  }
  const basis=verifyAccuracyBasis(a);
  return {basis,weight:basis ? 1 : (stats?.perfect!==undefined || stats?.great!==undefined) ? .85 : .75};
}
function makeObservation(a,name,kind,portions,quality) {
  const total=a.totalStableUnits,keys=a.columnCount;
  const valid=portions.filter(p=>!p.vibro&&p.star>0&&p.stableUnits.length);
  const unitIds=new Set();
  const values=[];
  let durationMs=0;
  for(const p of valid){
    const step=stepForStar(p.star,keys,kind);if(step===null)continue;
    const fresh=p.stableUnits.filter(id=>!unitIds.has(id));
    for(const id of fresh)unitIds.add(id);
    if(fresh.length){values.push({value:step,weight:fresh.length});durationMs+=p.durationMs*fresh.length/p.stableUnits.length;}
  }
  if(!unitIds.size||!values.length||!quality)return null;
  const share=clamp(unitIds.size/total,0,1);
  const localStep=quantile(values,.65);
  const wholeStep=stepForStar(kind==='LN'?a.wholeLn:a.wholeRc,keys,kind)??localStep;
  // Anchor the scale to the whole-map Mixed label, rather than letting a short
  // Sunny slice's length correction turn the entire profile into LN17/Gamma.
  const anchor=stepForLabel(a.wholeMapLabels?.[kind],keys,kind)??wholeStep;
  const localAdjustment=clamp(localStep-wholeStep,-5,2.5);
  const {accuracyPenalty,coveragePenalty}=contributionAdjustments(a.accuracy,share,keys,kind);
  const step=anchor+localAdjustment-5*(accuracyPenalty+coveragePenalty);
  const reliability=Math.min(1,unitIds.size/30,durationMs/4000);
  const weight=Math.min(1,share/.6)*reliability*quality.weight;
  if(!(weight>0))return null;
  return {name,kind,keys,step,share,weight,durationMs,unitCount:unitIds.size,
    accuracy:a.accuracy,accuracyPenalty,coveragePenalty,
    tier:labelAtStep(step,keys,kind),localTier:labelAtStep(localStep,keys,kind),
    anchorTier:labelAtStep(anchor,keys,kind),basisVerified:Boolean(quality.basis),
    mapId:a.mapId||a.checksum||a.sampleKey,title:a.title||''};
}

export function buildWeightedManiaProfile(analyses) {
  const observations=[],details=[];
  let segmentCount=0,vibroCount=0,unverifiedCount=0,invalidCount=0;
  analyses.forEach((input,index)=>{
    const a={...input,sampleKey:'sample-'+index};
    const quality=qualityOf(a);
    if(!quality)invalidCount++;
    else if(!quality.basis)unverifiedCount++;
    const portions=new Map([['RC',{name:'RC',kind:'RC',parts:[]}],['LN',{name:'LN',kind:'LN',parts:[]}]]);
    for(const seg of a.segments||[]){
      segmentCount++;if(seg.vibro)vibroCount++;
      const lnHeads=new Set(seg.lnStableUnits);
      portions.get('RC').parts.push({star:seg.rc,stableUnits:seg.stableUnits.filter(id=>!lnHeads.has(id)),durationMs:seg.durationMs,vibro:seg.vibro});
      portions.get('LN').parts.push({star:seg.ln,stableUnits:seg.lnStableUnits,durationMs:seg.durationMs,vibro:seg.vibro});
      for(const p of seg.patterns){
        const key=p.kind+':'+p.name;
        if(!portions.has(key))portions.set(key,{name:p.name,kind:p.kind,parts:[]});
        portions.get(key).parts.push({...p,star:p.kind==='LN'?seg.ln:seg.rc,
          durationMs:Math.min(p.durationMs,seg.durationMs),vibro:seg.vibro});
      }
    }
    const contributions=[];
    for(const p of portions.values()){
      const obs=makeObservation(a,p.name,p.kind,p.parts,quality);
      if(obs){observations.push(obs);contributions.push({name:maniaName(obs.name),tier:obs.tier,share:obs.share});}
    }
    details.push({mapId:a.mapId,title:a.title,keys:a.columnCount,accuracy:a.accuracy,basisVerified:Boolean(quality?.basis),
      wholeMapLabels:a.wholeMapLabels,contributions,
      segments:(a.segments||[]).map(s=>({from:s.from,to:s.to,durationMs:s.durationMs,rc:s.rc,ln:s.ln,
        rcLabel:s.rcLabel,lnLabel:s.lnLabel,lnRatio:s.lnRatio,notes:s.stableUnits.length,vibro:s.vibro,
        patterns:s.patterns.slice().sort((a,b)=>b.share-a.share).slice(0,3).map(p=>({name:maniaName(p.name),share:p.share}))}))});
  });
  const groups=new Map();
  for(const obs of observations){const key=obs.keys+':'+obs.kind+':'+obs.name;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(obs);}
  const skills=[...groups.entries()].map(([key,samples])=>{
    const byMap=new Map();
    for(const s of samples){const prior=byMap.get(s.mapId);if(!prior||s.step>prior.step)byMap.set(s.mapId,s);}
    const best=[...byMap.values()].sort((a,b)=>b.step-a.step).slice(0,5);
    const weighted=best.map((s,i)=>({value:s.step,weight:s.weight*[1,.85,.7,.55,.4][i]}));
    const step=weightedMean(weighted),first=best[0];
    const evidenceShare=weightedMean(best.map((s,i)=>({value:s.share,weight:weighted[i].weight})));
    const confidence=evidenceShare<.2?'低覆盖估计':best.length===1?'单图估计':best.length===2?'两图估计':'多图估计';
    return {key,name:first.name,kind:first.kind,keys:first.keys,nameZh:`${first.keys}K ${maniaName(first.name)}`,
      tier:labelAtStep(step,first.keys,first.kind),ratingStep:step,sampleCount:byMap.size,
      confidence,evidenceShare,accuracy:weightedMean(best.map((s,i)=>({value:s.accuracy,weight:weighted[i].weight}))),
      evidence:best};
  });
  return {algorithmVersion:WEIGHTED_VERSION,sampleCount:analyses.length,segmentCount,vibroCount,unverifiedCount,invalidCount,skills,details};
}
