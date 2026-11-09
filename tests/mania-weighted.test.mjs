import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeightedManiaProfile,stepForLabel,contributionAdjustments,skillAdjustments} from '../public/mania-weighted-profile.js';
import {maniaName} from '../public/mania-labels.js';
import {tableFor} from '../public/vendor/manialivedan/js/app/dan.js';
import {buildAnalysis,portraitRainbow} from '../functions/_shared/profile.js';

const ids=(count,offset=0)=>Array.from({length:count},(_,i)=>(i+offset)*2);
function center(kind,label){const row=tableFor(4,kind).find(([, ,name])=>name===label);assert.ok(row,label);return(row[0]+row[1])/2;}
function mixedPlay({share=.6,accuracy=.96,mapId=1,rc='Alpha mid',ln='LN 11 mid'}={}){
  const all=ids(1000),lnUnits=ids(Math.round(share*1000),1000-Math.round(share*1000));
  const pattern=(name,kind,units)=>({name,kind,core:name,stableUnits:units,lazerUnits:units,share:units.length/1000,durationMs:100000});
  return {mapId,columnCount:4,client:'stable',totalStableUnits:1000,totalLazerUnits:1000,
    accuracy,statistics:{great:Math.round(accuracy*1000),miss:1000-Math.round(accuracy*1000)},
    wholeRc:center('RC',rc),wholeLn:center('LN',ln),wholeMapLabels:{RC:rc,LN:ln},
    segments:[{from:1000,to:101000,durationMs:100000,rc:center('RC',rc),ln:center('LN',ln),rcLabel:rc,lnLabel:ln,
      stableUnits:all,lazerUnits:all,lnStableUnits:lnUnits,lnLazerUnits:lnUnits,lnRatio:share,vibro:false,
      patterns:[pattern('Stream','RC',ids(600)),pattern('Jacks','RC',ids(200,100)),pattern('Density','LN',lnUnits)]}]};
}

test('owner example: overlapping 20% jack / 60% stream / 60% density at Alpha LN11 and 96% yields Alpha stream and LN10',()=>{
  const result=buildWeightedManiaProfile([mixedPlay()]);
  const stream=result.skills.find(s=>s.name==='Stream'),density=result.skills.find(s=>s.name==='Density');
  assert.equal(stream.tier,'Alpha mid');assert.equal(density.tier,'LN 10 mid');
  assert.equal(stream.evidenceShare,.6);assert.equal(density.evidenceShare,.6);
  assert.ok(result.skills.every(s=>s.tier!=='证据不足'));
  assert.equal(result.skills.find(s=>s.name==='Jacks').evidenceShare,.2);
  assert.ok(result.skills.find(s=>s.name==='Jacks').ratingStep<stream.ratingStep);
});
test('20% LN and 93.5% still contributes an estimate but does not receive LN12 from the map',()=>{
  const result=buildWeightedManiaProfile([mixedPlay({share:.2,accuracy:.935,ln:'LN 12 high'})]);
  const ln=result.skills.find(s=>s.name==='LN');assert.ok(ln);assert.notEqual(ln.tier,'证据不足');
  assert.ok(ln.ratingStep<stepForLabel('LN 10 mid',4,'LN'));
});
test('lower coverage and lower accuracy monotonically reduce the contribution, overlapping features remain independent',()=>{
  const at=(share,accuracy)=>{
    const play=mixedPlay({accuracy});play.segments[0].patterns.find(p=>p.name==='Density').stableUnits=ids(Math.round(share*1000),400);
    return buildWeightedManiaProfile([play]).skills.find(s=>s.name==='Density');
  };
  assert.ok(at(.2,.96).ratingStep<at(.6,.96).ratingStep);
  assert.ok(at(.6,.935).ratingStep<at(.6,.96).ratingStep);
  assert.ok(at(.2,.96).evidence[0].weight<at(.6,.96).evidence[0].weight);
  assert.equal(contributionAdjustments(.96,.6,4,'RC').coveragePenalty,0);
});

test('rare RC features lose at most one level to frequency and remain lower-weight evidence',()=>{
  const play=mixedPlay({rc:'Gamma mid'});
  const rare=play.segments[0].patterns.find(p=>p.name==='Jacks');rare.stableUnits=ids(100);
  const skill=buildWeightedManiaProfile([play]).skills.find(s=>s.name==='Jacks');
  assert.ok(skill.ratingStep>=stepForLabel('Beta mid',4,'RC'));
  assert.ok(skill.ratingStep<stepForLabel('Gamma mid',4,'RC'));
  assert.ok(skill.evidence[0].weight<.2);
  assert.equal(skillAdjustments(.96,.001,4,'RC').coveragePenalty,1);
  assert.ok(skillAdjustments(.94,.5,4,'RC').accuracyPenalty<contributionAdjustments(.94,.5,4,'RC').accuracyPenalty);
});

test('LN frequency is measured within LN and its accuracy bar is preserved',()=>{
  const dominant=buildWeightedManiaProfile([mixedPlay({share:.2,accuracy:.97})]).skills.find(s=>s.name==='Density');
  assert.equal(dominant.domainEvidenceShare,1);
  assert.equal(dominant.evidenceShare,.2);
  assert.equal(dominant.evidence[0].coveragePenalty,0);
  assert.equal(skillAdjustments(.96,1,4,'LN').accuracyPenalty,contributionAdjustments(.96,1,4,'LN').accuracyPenalty);
});

test('LN-head structures can support RC singles even on an all-LN chart',()=>{
  const play=mixedPlay({share:1,accuracy:.97,rc:'Gamma mid'});
  const skill=buildWeightedManiaProfile([play]).skills.find(s=>s.name==='Stream');
  assert.ok(skill);assert.equal(skill.tier,'Gamma mid');
  // No change to the archived v2 headline policy on pure LN charts.
  assert.ok(!buildWeightedManiaProfile([play]).skills.some(s=>s.name==='RC'));
});

test('concurrent RC load supports LN subtype difficulty without adding two dan scales',()=>{
  const make=rc=>{
    const play=mixedPlay({accuracy:.97});play.segments[0].ln=center('LN','LN 9 mid');
    play.segments[0].rc=center('RC',rc);
    return buildWeightedManiaProfile([play]).skills.find(s=>s.name==='Density');
  };
  const easy=make('Reform 8 mid'),hard=make('Gamma mid');
  assert.ok(hard.ratingStep>easy.ratingStep);
  assert.ok(hard.evidence[0].contextAdjustment>0);
  assert.ok(hard.ratingStep<=stepForLabel('LN 11 mid',4,'LN'));
  const unrelated=mixedPlay({accuracy:.97});unrelated.segments[0].ln=center('LN','LN 9 mid');
  unrelated.segments.push({...structuredClone(unrelated.segments[0]),rc:center('RC','Gamma mid'),patterns:[],lnStableUnits:[],lnLazerUnits:[]});
  const untouched=buildWeightedManiaProfile([unrelated]).skills.find(s=>s.name==='Density');
  assert.equal(untouched.evidence[0].contextAdjustment,make('Alpha mid').evidence[0].contextAdjustment);
  assert.equal(untouched.ratingStep,make('Alpha mid').ratingStep);
});
test('unreconciled client judgement formula reduces reliability rather than suppressing all ability cards',()=>{
  const score={...mixedPlay(),client:'lazer',totalLazerUnits:1600};
  const report=buildWeightedManiaProfile([score]);assert.equal(report.unverifiedCount,1);
  assert.equal(report.skills.find(s=>s.name==='Stream').tier,'Alpha mid');
  assert.ok(report.skills.find(s=>s.name==='Stream').evidence[0].weight<1);
});
test('absent plays, incomplete scores and corrupt statistics cannot produce ratings',()=>{
  assert.equal(buildWeightedManiaProfile([]).skills.length,0);
  for(const override of [{accuracy:NaN},{accuracy:0},{statistics:{great:500}},{statistics:{great:-1}},{statistics:{great:0}}]){
    const report=buildWeightedManiaProfile([{...mixedPlay(),...override}]);assert.equal(report.skills.length,0);assert.equal(report.invalidCount,1);
  }
});
test('Sunny spike gets a bounded local adjustment, same map cannot multiply sample count, keys stay separate',()=>{
  const base=mixedPlay(),spike=structuredClone(base);spike.segments[0].rc=center('RC','Gamma mid');
  const report=buildWeightedManiaProfile([spike,spike]);
  const skill=report.skills.find(s=>s.name==='Stream');assert.equal(skill.sampleCount,1);
  assert.ok(skill.ratingStep<=stepForLabel('Alpha mid',4,'RC')+2.5);
  const other={...mixedPlay({mapId:2}),columnCount:7};
  const mixed=buildWeightedManiaProfile([base,other]);assert.ok(mixed.skills.some(s=>s.keys===4));assert.ok(mixed.skills.some(s=>s.keys===7));
});
test('suspected Vibro contributes no ordinary skill estimate',()=>{
  const a=mixedPlay();a.segments[0].vibro=true;assert.equal(buildWeightedManiaProfile([a]).skills.length,0);
});
test('requested Chinese names and remaining subtypes are translated',()=>{
  for(const [key,value] of Object.entries({RC:'常规',LN:'面条',Stream:'单乱',Coordination:'协调',Release:'放手',Shield:'盾',Inverse:'反键',Quadstream:'四押切',Jumptrill:'对拍',Longjacks:'纵叠',Chordjacks:'大叠','Split Trill':'对切',SplitTrill:'对切','Column Lock':'锁手'}))assert.equal(maniaName(key),value);
  for(const key of ['HS Density','JS Density','DS Density','DCS Density','LCS Density','Jacky WC','Speedy WC','Split Trill','Gluts'])assert.ok(!/[A-Za-z]/.test(maniaName(key)));
});

function rawScore(lazer,perfect=500,great=1000){return {id:1,is_lazer:lazer,accuracy:.99,statistics:{perfect,great},beatmap:{id:1,mode:'mania',cs:4}};}
test('lazer rainbow has half the portrait influence while raw and per-client ratios stay unchanged',()=>{
  const user={id:1,username:'Test'};
  const stable=buildAnalysis(user,[rawScore(false)],[],'mania','4k');
  const lazer=buildAnalysis(user,[rawScore(true)],[],'mania','4k');
  assert.equal(stable.metrics.rainbow,.5);assert.equal(lazer.metrics.rainbow,.5);
  assert.equal(stable.clients.stable.rainbow,.5);assert.equal(lazer.clients.lazer.rainbow,.5);
  assert.equal(lazer.metrics.rainbowAdjusted,stable.metrics.rainbowAdjusted*.5);
  assert.equal(stable.playStyle.label,'准度型');assert.equal(lazer.playStyle.label,'推难度型');
});
test('lazer discount is not cancelled by denominator normalisation and perfect-only ratios cannot dominate',()=>{
  assert.equal(portraitRainbow([{rainbowRatio:99,client:'lazer'}]),.5);
  assert.equal(portraitRainbow([{rainbowRatio:99,client:'stable'}]),1);
  const expected=(.4+.965*.4*.5)/(1+.965);
  assert.ok(Math.abs(portraitRainbow([{rainbowRatio:.4,client:'stable'},{rainbowRatio:.4,client:'lazer'}])-expected)<1e-12);
});
