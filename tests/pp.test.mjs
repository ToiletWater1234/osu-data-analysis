import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initSync} from '../public/vendor/rosu-pp/rosu_pp_js.js';
import {calculateScorePp,performanceArguments} from '../public/pp-engine.js';
initSync({module:fs.readFileSync(new URL('../public/vendor/rosu-pp/rosu_pp_js_bg.wasm',import.meta.url))});
function chart(ln=false){const objects=Array.from({length:1200},(_,i)=>{const x=Math.floor(((i+Math.floor(i/4))%4+.5)*128),t=1000+i*75;return `${x},192,${t},${ln?128:1},0,${ln?t+100+':0:0:0:0:':'0:0:0:0:'}`;});return `osu file format v14\n[General]\nMode:3\n[Metadata]\nTitle:PP test\nArtist:test\nCreator:test\nVersion:4K\n[Difficulty]\nCircleSize:4\nOverallDifficulty:8\nHPDrainRate:5\nSliderMultiplier:1.4\nSliderTickRate:1\n[TimingPoints]\n0,300,4,2,1,100,1,0\n[HitObjects]\n${objects.join('\n')}\n`;}
const score={statistics:{perfect:1100,great:80,good:10,ok:5,meh:3,miss:2},client:'stable',mods:[],modDetails:[]};
test('vendored WASM follows the official mania PP formula using actual judgement counts',()=>{
  const result=calculateScorePp(chart(),score);
  const accuracy=(1100*320+80*300+10*200+5*100+3*50)/(1200*320);
  const expected=8*Math.pow(Math.max(result.stars-.15,.05),2.2)*Math.max(0,5*accuracy-4)*(1+.1*Math.min(1,1200/1500));
  assert.ok(result.pp>0);assert.ok(Math.abs(result.pp-expected)<1e-9,`${result.pp} vs ${expected}`);
});
test('PP reflects actual performance and rate mods; NF uses the official multiplier',()=>{
  const nm=calculateScorePp(chart(),score),nf=calculateScorePp(chart(),{...score,mods:['NF']}),dt=calculateScorePp(chart(),{...score,mods:['DT']}),ss=calculateScorePp(chart(),{...score,statistics:{perfect:1200}});
  assert.ok(Math.abs(nf.pp/nm.pp-.75)<1e-10);assert.ok(dt.pp>nm.pp);assert.ok(ss.pp>nm.pp);
});
test('LN charts use supplied counts without generating SS judgements',()=>{
  const result=calculateScorePp(chart(true),score);assert.ok(Number.isFinite(result.pp));assert.equal(result.basis,'actual-judgements');
  assert.ok(Number.isFinite(calculateScorePp(chart(true),{...score,client:'lazer',statistics:{perfect:2400}}).pp));
});
test('missing or incomplete scores and unsupported mods are rejected instead of receiving hypothetical PP',()=>{
  assert.throws(()=>calculateScorePp(chart(),{...score,statistics:{}}),/没有实际判定/);
  assert.throws(()=>calculateScorePp(chart(),{...score,statistics:{perfect:50}}),/不足/);
  assert.throws(()=>performanceArguments({...score,mods:['AT']}),/Mod/);
  assert.throws(()=>performanceArguments({...score,statistics:{perfect:-1}}),/有效/);
  const args=performanceArguments(score).args;assert.equal(args.nKatu,10);assert.equal(args.n100,5);assert.equal(args.accuracy,undefined);
});
