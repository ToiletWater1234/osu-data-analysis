import { tableFor, labelFor } from './vendor/manialivedan/js/app/dan.js';

const MIN_DURATION_MS = 4000;
const MIN_UNITS = 30;
const MIN_DOMINANCE = 0.8;
const NAMES = {Stream:'单押流',Chordstream:'复合流',Jacks:'叠键',Longjacks:'长叠',Chordjacks:'和弦叠',
  Minijacks:'小叠',Rolls:'楼梯',Trills:'交互',Minitrills:'短交互',Jumptrill:'双押交互',
  Jumpstream:'双押切',Handstream:'三押切',Coordination:'LN 协调',Density:'面切',Wildcard:'LN 综合',
  'Column Lock':'锁列',Shield:'盾 / 盾反',Release:'松键 / 尾判',Inverse:'反键 / 空心 LN'};

export function accuracyLowerBound(accuracy, share) {
  if (!(accuracy >= 0 && accuracy <= 1) || !(share > 0 && share <= 1)) return null;
  return Math.max(0, 1-(1-accuracy)/share);
}

// Bounds are only valid when complete judgement totals and the accuracy formula
// can be reconciled with this exact beatmap. An unknown basis yields no rating.
export function verifyAccuracyBasis(analysis) {
  const stats = analysis.statistics;
  const fields = ['perfect','great','good','ok','meh','miss'];
  if (!stats || fields.some(k => !Number.isSafeInteger(stats[k] ?? 0) || (stats[k] ?? 0) < 0)) return null;
  const total = fields.reduce((sum,k)=>sum+(stats[k]??0),0);
  const mode = analysis.client === 'stable' ? 'stable' : analysis.client === 'lazer' ? 'lazer' : null;
  if (!mode || !total || total !== analysis[mode==='stable'?'totalStableUnits':'totalLazerUnits']) return null;
  const s = Object.fromEntries(fields.map(k=>[k,stats[k]??0]));
  const score300 = (300*(s.perfect+s.great)+200*s.good+100*s.ok+50*s.meh)/(300*total);
  const score320 = (320*s.perfect+300*s.great+200*s.good+100*s.ok+50*s.meh)/(320*total);
  const acc = Number(analysis.accuracy);
  if (!Number.isFinite(acc) || acc < 0 || acc > 1) return null;
  const valid = mode==='stable' ? [score300] : [score300,score320];
  if (!valid.some(a=>Math.abs(a-acc)<=0.00001)) return null;
  return {mode,total,accuracy:acc};
}

function standard(keys, kind) { return kind==='RC'?0.96:keys===7?0.95:keys===4?0.97:0.96; }
function rankOf(star,keys,kind) { return tableFor(keys,kind).findIndex(([lo,hi])=>star>=lo&&star<=hi); }
function makeObservation(analysis, name, kind, portions, basis) {
  const keys = analysis.columnCount;
  const exposed = portions.filter(p=>p.star>0&&labelFor(p.star,keys,kind));
  const bestExposure = exposed.slice().sort((a,b)=>b.star-a.star)[0];
  let supported = null;
  if (basis) {
    const dominant = exposed.filter(p=>!p.vibro&&p.share>=MIN_DOMINANCE);
    for (const star of [...new Set(dominant.map(p=>p.star))].sort((a,b)=>b-a)) {
      const selected = dominant.filter(p=>p.star>=star);
      const units = new Set(selected.flatMap(p=>p[basis.mode+'Units']));
      const durationMs = selected.reduce((sum,p)=>sum+p.durationMs,0);
      const share = units.size/basis.total;
      const lower = accuracyLowerBound(basis.accuracy,share);
      if (durationMs>=MIN_DURATION_MS && units.size>=MIN_UNITS && lower!==null && lower+1e-10>=standard(keys,kind)) {
        supported = {star,rank:rankOf(star,keys,kind),tier:labelFor(star,keys,kind),share,lowerAccuracy:lower,durationMs};
        break;
      }
    }
  }
  return {name,kind,keys,supported,exposureTier:bestExposure?labelFor(bestExposure.star,keys,kind):'',
    exposureStar:bestExposure?.star||0,basisVerified:Boolean(basis),
    mapId:analysis.mapId||analysis.checksum||analysis.sampleKey,title:analysis.title||'',
    passStandard:standard(keys,kind)};
}

export function buildSegmentedManiaProfile(analyses) {
  const observations = [];
  let segmentCount=0,vibroCount=0,unverifiedCount=0;
  const details=[];
  analyses.forEach((analysis,index)=>{
    const basis=verifyAccuracyBasis(analysis);
    if (!basis) unverifiedCount++;
    const a={...analysis,sampleKey:'sample-'+index};
    const portions = new Map([['RC',[]],['LN',[]]]);
    const patternPortions=new Map();
    for (const seg of analysis.segments||[]) {
      segmentCount++; if(seg.vibro)vibroCount++;
      const total=Math.max(1,seg.stableUnits.length);
      const lnHeads=new Set(seg.lnStableUnits);
      const rcUnits=seg.stableUnits.filter(id=>!lnHeads.has(id));
      const lnUnitSet=new Set(seg.lnLazerUnits);
      portions.get('RC').push({star:seg.rc,share:rcUnits.length/total,
        stableUnits:rcUnits,lazerUnits:seg.lazerUnits.filter(id=>!lnUnitSet.has(id)),durationMs:seg.durationMs,vibro:seg.vibro});
      portions.get('LN').push({star:seg.ln,share:seg.lnStableUnits.length/total,
        stableUnits:seg.lnStableUnits,lazerUnits:seg.lnLazerUnits,durationMs:seg.durationMs,vibro:seg.vibro});
      for (const p of seg.patterns) {
        const key=p.kind+':'+p.name;
        if(!patternPortions.has(key))patternPortions.set(key,{name:p.name,kind:p.kind,parts:[]});
        patternPortions.get(key).parts.push({...p,durationMs:Math.min(p.durationMs,seg.durationMs),star:p.kind==='LN'?seg.ln:seg.rc,vibro:seg.vibro});
      }
    }
    for(const kind of ['RC','LN'])observations.push(makeObservation(a,kind,kind,portions.get(kind),basis));
    for(const p of patternPortions.values())observations.push(makeObservation(a,p.name,p.kind,p.parts,basis));
    details.push({mapId:a.mapId,title:a.title,keys:a.columnCount,accuracy:a.accuracy,basisVerified:Boolean(basis),
      segments:a.segments.map(s=>({from:s.from,to:s.to,durationMs:s.durationMs,rc:s.rc,ln:s.ln,
        rcLabel:s.rcLabel,lnLabel:s.lnLabel,lnRatio:s.lnRatio,notes:s.stableUnits.length,vibro:s.vibro,
        patterns:s.patterns.slice().sort((a,b)=>b.share-a.share).slice(0,3).map(p=>({name:NAMES[p.name]||p.name,share:p.share}))}))});
  });
  const groups=new Map();
  for(const obs of observations){const key=obs.keys+':'+obs.kind+':'+obs.name;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(obs);}
  const skills=[...groups.entries()].map(([key,samples])=>{
    const supportedByMap=new Map();
    for(const s of samples.filter(s=>s.supported)){
      const current=supportedByMap.get(s.mapId);
      if(!current||current.supported.rank<s.supported.rank)supportedByMap.set(s.mapId,s);
    }
    const best=[...supportedByMap.values()].sort((a,b)=>b.supported.rank-a.supported.rank).slice(0,3);
    // Two or more independent maps: use the second strongest result, so a single
    // outlier cannot raise the displayed tier. One map remains explicitly tentative.
    const representative=best.length>1?best[1]:best[0];
    const first=samples[0];
    const exposure=samples.slice().sort((a,b)=>b.exposureStar-a.exposureStar)[0];
    return {key,name:first.name,kind:first.kind,keys:first.keys,
      nameZh:`${first.keys}K ${first.name==='RC'?'米键 / 常规':first.name==='LN'?'长条':NAMES[first.name]||first.name}`,
      tier:representative?.supported.tier||'证据不足',sampleCount:samples.filter(s=>s.exposureTier).length,
      supportedCount:supportedByMap.size,confidence:best.length>=3?'较多样本支持':best.length===2?'两图支持':best.length===1?'单图暂定':'无法确认',
      passStandard:first.passStandard,lowerAccuracy:representative?.supported.lowerAccuracy??null,
      evidenceShare:representative?.supported.share??null,exposureTier:exposure?.exposureTier||'',
      evidence:best.map(s=>({mapId:s.mapId,title:s.title,...s.supported}))};
  }).filter(s=>s.sampleCount>0||['RC','LN'].includes(s.name));
  return {algorithmVersion:'segments-v1',sampleCount:analyses.length,segmentCount,vibroCount,unverifiedCount,skills,details};
}
