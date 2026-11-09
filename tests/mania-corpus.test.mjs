import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildWeightedManiaProfile} from '../public/mania-weighted-profile.js';

const corpus=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/mania-v3-b50.json.gz',import.meta.url))));
const expand=ranges=>ranges.flatMap(([lo,hi])=>Array.from({length:(hi-lo)/2+1},(_,i)=>lo+i*2));
const charts=Object.fromEntries(Object.entries(corpus.charts).map(([key,a])=>[key,{...a,segments:a.segments.map(s=>({...s,
 stableUnits:expand(s.stableUnits),lnStableUnits:expand(s.lnStableUnits),
 patterns:s.patterns.map(p=>({...p,stableUnits:expand(p.stableUnits)}))}))}]));
const results=corpus.players.map(p=>({...p,profile:buildWeightedManiaProfile(p.plays.map(play=>({...charts[play.chart],...play})))}));
const greek=['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa'];
function courseLevel(label){
 const named=greek.findIndex(name=>new RegExp('\\b'+name+'\\b','i').test(label));
 const level=named>=0?11+named:Number(label.match(/(?:Reform |LN )?(\d+)/)?.[1]);
 const sub=/mid\/high/.test(label)?.2:/mid\/low/.test(label)?-.2:/high/.test(label)?.4:/low/.test(label)?-.4:0;
 return level+sub;
}

test('five real B50 cohorts retain exactly the v2 headline tiers, values and sample counts',()=>{
 assert.equal(Object.keys(charts).length,117);
 for(const p of results){
  assert.equal(p.plays.length,50,p.name);
  const headlines=p.profile.skills.filter(s=>['RC','LN'].includes(s.name)).map(s=>({name:s.name,tier:s.tier,ratingStep:s.ratingStep,sampleCount:s.sampleCount}));
  assert.deepEqual(headlines,p.headline,p.name);
 }
});

test('coarse RC families and LN coordination stay within one course of the five public Tracker snapshots',()=>{
 // Tracker's jack/speed/tech families are broader than our narrow subtypes.
 // Compare the strongest supported subtype, not each subtype with a parent.
 const families={jack:['Jacks','Longjacks','Chordjacks','Minijacks'],speed:['Stream','Trills','Minitrills'],tech:['Chordstream','Jumpstream','Handstream','Rolls','Split Trill','Jumptrill','Gluts','Quadstream']};
 for(const p of results){
  for(const [key,names]of Object.entries(families)){
   const skill=p.profile.skills.filter(s=>names.includes(s.name)).sort((a,b)=>b.ratingStep-a.ratingStep)[0];
   const gap=Math.abs(courseLevel(skill.tier)-p.tracker.dan.rc.skillsets[key].rawDan);
   assert.ok(gap<=1.000001,`${p.name} ${key}: ${skill.tier}, gap ${gap}`);
  }
  // A coarse sanity check; Coordination and Tracker LN Technical are not an
  // exact equivalence. Walls/Hybrid/Speed are deliberately not equated to them.
  const coordination=p.profile.skills.find(s=>s.name==='Coordination');
  assert.ok(Math.abs(courseLevel(coordination.tier)-p.tracker.dan.ln.skillsets.lntechnical.rawDan)<=1.000001,p.name+' LN coordination sanity check');
 }
});
