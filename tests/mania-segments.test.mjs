import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeSegmentedManiaText, unionRanges, splitPatternTransitions} from '../public/mania-segment-engine.js';
import {buildSegmentedManiaProfile, accuracyLowerBound, verifyAccuracyBasis} from '../public/mania-segment-profile.js';
import {sliceOsuTextByTimeRange} from '../public/vendor/manialivedan/js/lib/parser/osuTimeSlice.js';
import {tableFor} from '../public/vendor/manialivedan/js/app/dan.js';
import {Worker} from 'node:worker_threads';

function chart(keys=4, hybrid=false) {
  const objects=Array.from({length:800},(_,i)=>{
    const t=1000+i*75,ln=hybrid&&i>=600;
    const x=Math.floor(((i+Math.floor(i/4))%keys+.5)*512/keys);
    return `${x},192,${t},${ln?128:1},0,${ln?t+100+':0:0:0:0:':'0:0:0:0:'}`;
  });
  return `osu file format v14\n[General]\nMode:3\n[Difficulty]\nCircleSize:${keys}\nOverallDifficulty:8\nHPDrainRate:5\n[TimingPoints]\n0,300,4,2,1,100,1,0\n[HitObjects]\n${objects.join('\n')}\n`;
}
const ids=(count,offset=0)=>Array.from({length:count},(_,i)=>(i+offset)*2);
function section(units,{ln=false,star=6,from=1000,duration=10000,name=ln?'Coordination':'Stream'}={}){
  return {from,to:from+duration,durationMs:duration,rc:ln?0:star,ln:ln?star:0,
    rcLabel:'',lnLabel:'',stableUnits:units,lazerUnits:units,lnStableUnits:ln?units:[],lnLazerUnits:ln?units:[],lnRatio:ln?1:0,
    patterns:[{name,kind:ln?'LN':'RC',core:name,stableUnits:units,lazerUnits:units,share:1,durationMs:duration}],vibro:false};
}
function play(segments,{miss=0,total=1000,mapId=1}={}){
  return {mapId,columnCount:4,totalStableUnits:total,totalLazerUnits:total,client:'stable',
    accuracy:1-miss/total,statistics:{great:total-miss,miss},segments};
}
function center(keys,kind,match){const item=tableFor(keys,kind).find(([, ,name])=>name===match);assert.ok(item);return(item[0]+item[1])/2;}

test('archived legacy engine and aggregation remain byte-identical',()=>{
  for(const [file,expected] of [['mania-engine.js','5872f09e1332144d769f31353bbb0bc3121ba28d6a0f64a06b6ed69c7338b9c2'],['mania-profile.js','71354be5f0b8c8c97407280443baf9f6b9b3155884877e90e60c4ea32502b5c7']]){
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../public/'+file,import.meta.url))).digest('hex'),expected);
  }
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../archives/mania-legacy-2026-11-03.zip',import.meta.url))).digest('hex'),'4e16d2ff59a1e0863dd752f3ea0146913aa9bafcaca7e1eef0c2e08d72d5653b');
});
test('local difficulty on real 4K/6K/7K structures has finite values and partitions judgement units once',()=>{
  for(const keys of [4,6,7]){
    const result=analyzeSegmentedManiaText(chart(keys,true));
    assert.equal(result.columnCount,keys);assert.equal(result.totalStableUnits,800);assert.equal(result.totalLazerUnits,1000);
    assert.ok(result.segments.length>1);
    assert.ok(result.segments.length<=10);
    const stable=result.segments.flatMap(s=>s.stableUnits),lazer=result.segments.flatMap(s=>s.lazerUnits);
    assert.equal(stable.length,800);assert.equal(new Set(stable).size,800);
    assert.equal(lazer.length,1000);assert.equal(new Set(lazer).size,1000);
    assert.ok(result.segments.every(s=>Number.isFinite(s.rc)&&Number.isFinite(s.ln)));
    assert.ok(result.segments.some(s=>s.lnRatio===0));assert.ok(result.segments.some(s=>s.lnRatio>0));
  }
});
test('short Gamma jack does not inherit a high whole-map rating from 96% accuracy',()=>{
  const low=center(4,'RC','Reform 5 mid'),high=center(4,'RC','Gamma mid');
  const report=buildSegmentedManiaProfile([play([section(ids(900),{star:low,duration:90000}),section(ids(100,900),{star:high,from:91000,name:'Longjacks'})],{miss:40})]);
  const jack=report.skills.find(s=>s.name==='Longjacks');
  assert.equal(jack.tier,'证据不足');assert.equal(jack.exposureTier,'Gamma mid');
  assert.equal(report.skills.find(s=>s.name==='RC').tier,'Reform 5 mid');
});
test('93.5% hybrid score with 20% LN cannot confirm LN12',()=>{
  const star=center(4,'LN','LN 12 high');
  const report=buildSegmentedManiaProfile([play([section(ids(800),{duration:80000}),section(ids(200,800),{ln:true,star,from:81000,duration:20000})],{miss:65})]);
  assert.equal(report.unverifiedCount,0);
  const ln=report.skills.find(s=>s.name==='LN');assert.equal(ln.tier,'证据不足');assert.equal(ln.exposureTier,'LN 12 high');
  assert.ok(Math.abs(accuracyLowerBound(.935,.2)-.675)<1e-10);
});
test('three independent dominant scores support a tier; duplicate maps and one outlier cannot raise it',()=>{
  const low=center(4,'RC','Reform 5 mid'),high=center(4,'RC','Gamma mid');
  const sample=(mapId,star)=>play([section(ids(1000),{star})],{mapId,miss:10});
  const report=buildSegmentedManiaProfile([sample(1,high),sample(1,high),sample(2,low),sample(3,low)]);
  const rc=report.skills.find(s=>s.name==='RC');assert.equal(rc.tier,'Reform 5 mid');assert.equal(rc.supportedCount,3);
  assert.equal(rc.confidence,'较多样本支持');
});
test('missing, mismatched or partial judgement data cannot manufacture a local ability',()=>{
  const a=play([section(ids(1000))]);
  for(const changed of [{statistics:null},{statistics:{great:999}},{accuracy:.935},{client:'unknown'},{statistics:{great:-1,miss:1001}}]){
    const item={...a,...changed};assert.equal(verifyAccuracyBasis(item),null);
    assert.ok(buildSegmentedManiaProfile([item]).skills.every(s=>s.tier==='证据不足'));
  }
});
test('very short and suspected vibro sections remain chart references only',()=>{
  for(const changed of [{durationMs:3000},{vibro:true}]){
    const s={...section(ids(1000)),...changed};
    assert.ok(buildSegmentedManiaProfile([play([s])]).skills.every(s=>s.tier==='证据不足'));
  }
});
test('same-difficulty pattern transition can create a boundary',()=>{
  const notes=Array.from({length:160},(_,i)=>({t:1000+i*100}));
  const result=splitPatternTransitions([{from:1000,to:17000}],
    [{name:'Stream',ranges:[[1000,9000]]},{name:'Longjacks',ranges:[[9000,17000]]}],notes,1000,17000);
  assert.deepEqual(result,[{from:1000,to:9000},{from:9000,to:17000}]);
});
test('slice retains whole crossing LN and timing context; overlapping ranges are unioned',()=>{
  const source=chart().replace('[HitObjects]','[HitObjects]\n64,192,800,128,0,2500:0:0:0:0:');
  const sliced=sliceOsuTextByTimeRange(source,1000,2000).text;
  assert.match(sliced,/64,192,800,128,0,2500/);assert.match(sliced,/0,300,4,2,1,100,1,0/);
  assert.deepEqual(unionRanges([[1,5],[2,7],[7,9],[20,25]]),[[1,9],[20,25]]);
});
test('DT preserves source timeline ownership while adjusting played durations',()=>{
  const nm=analyzeSegmentedManiaText(chart()),dt=analyzeSegmentedManiaText(chart(),1.5);
  assert.equal(dt.totalStableUnits,nm.totalStableUnits);
  const sum=a=>a.segments.reduce((v,s)=>v+s.durationMs,0);
  assert.ok(Math.abs(sum(nm)/sum(dt)-1.5)<1e-10);
  assert.throws(()=>analyzeSegmentedManiaText('<html>bad</html>'),/有效/);
});
test('lazer head/tail judgement basis must agree with actual count and accuracy',()=>{
  const base={client:'lazer',totalLazerUnits:1200,accuracy:1,statistics:{perfect:1200}};
  assert.equal(verifyAccuracyBasis(base)?.total,1200);
  assert.equal(verifyAccuracyBasis({...base,statistics:{perfect:1000}}),null);
  assert.equal(verifyAccuracyBasis({...base,accuracy:.9}),null);
});
test('real Worker dispatcher runs the selected engine and preserves the legacy route',async()=>{
  const workerUrl=new URL('../public/mania-worker.js',import.meta.url).href;
  const bootstrap=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:value=>parentPort.postMessage(value)};await import(${JSON.stringify(workerUrl)});parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`;
  const run=algorithm=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bootstrap)),{type:'module'});
    const timer=setTimeout(()=>{worker.terminate();reject(Error('Worker timeout'));},10000);
    worker.on('error',error=>{clearTimeout(timer);worker.terminate();reject(error);});
    worker.on('message',data=>{if(data.ready)worker.postMessage({source:chart(),rate:1,algorithm});
      else {clearTimeout(timer);worker.terminate();data.error?reject(Error(data.error)):resolve(data.result);}});
  });
  const [legacy,trial,compat]=await Promise.all([run('legacy'),run('segments-v3'),run('segments-v2')]);
  assert.ok(legacy.patternAnalysis.clusters.length);assert.equal(legacy.segments,undefined);
  assert.ok(trial.segments.length);assert.equal(trial.algorithmVersion,'segments-v3');
  assert.deepEqual(compat,trial);
  assert.ok(trial.wholeMapLabels.RC);
});
