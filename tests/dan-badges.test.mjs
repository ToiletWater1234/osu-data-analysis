import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {danBadge} from '../public/dan-badges.js';
import {renderMainTierCards} from '../public/main-tier-cards.js';
import {tableFor} from '../public/vendor/manialivedan/js/app/dan.js';

test('badge paths distinguish 4K RC, 7K RC and 7K LN and preserve subtiers',()=>{
 assert.match(danBadge(4,'RC','Alpha mid').src,/reform\/alpha.webp$/);
 assert.match(danBadge(4,'RC','CloverWisp Theta mid/high').src,/theta-mid-high.webp$/);
 assert.match(danBadge(4,'RC','Reform 8 low').src,/reform\/8-low.svg$/);
 assert.match(danBadge(7,'RC','Regular Gamma mid/low').src,/7k\/gamma-mid-low.svg$/);
 assert.match(danBadge(7,'LN','LN Gamma mid/low').src,/7k\/ln-gamma-mid-low.svg$/);
 assert.match(danBadge(7,'LN','LN 10 high').src,/7k\/ln-10-high.svg$/);
});
test('4K LN uses owner-provided badges for levels 1–15 and retains the subtier in text',()=>{
 for(let level=1;level<=15;level++)for(const grade of ['low','mid/low','mid','mid/high','high']){
  const badge=danBadge(4,'LN',`LN ${level} ${grade}`);
  assert.equal(badge.src,`/images/ln-dans/${level}.png`);
  assert.match(badge.alt,new RegExp(grade));
 }
 const html=renderMainTierCards([{keys:4,kind:'LN',tier:'LN 11 high',name:'4K 面条段位',value:'LN 11 high'}]);
 assert.match(html,/<img[^>]+src="\/images\/ln-dans\/11.png"/);assert.match(html,/LN 11 high/);
});
test('missing, unsupported, below-range and Wild tiers do not borrow another badge',()=>{
 for(const [keys,kind,tier] of [[4,'LN','Hypersovae LN 16 high'],[4,'LN','Lnlism LN 17 low'],[4,'LN','LN 20 high'],[4,'LN','< LN 5 mid'],[4,'LN','LN 0 mid'],[6,'RC','Regular 9 mid'],[7,'RC','Wild 8 high'],[4,'RC','< Reform 1 low'],[4,'RC','Intro 1 mid'],[7,'LN','暂无可用成绩']])assert.equal(danBadge(keys,kind,tier),null);
});
test('every in-range supported label resolves to a real local badge',()=>{
 for(const [keys,kind] of [[4,'RC'],[4,'LN'],[7,'RC'],[7,'LN']])for(const [, ,tier] of tableFor(keys,kind)){
  const badge=danBadge(keys,kind,tier);if(/Intro|Wild|Lambda|\bMu\b|\bNu\b|\bXi\b|Omicron|\bPi\b|\bRho\b/.test(tier)||(keys===4&&kind==='LN'&&Number(tier.match(/LN (\d+)/)?.[1])>15)){assert.equal(badge,null);continue;}
  assert.ok(badge,tier);assert.ok(fs.existsSync(new URL('../public'+badge.src,import.meta.url)),badge.src);
 }
});

test('all 15 extracted 4K LN badges match their source records and are alpha-channel PNGs',()=>{
 const base=new URL('../public/images/ln-dans/',import.meta.url);
 const source=JSON.parse(fs.readFileSync(new URL('SOURCE.json',base)));
 assert.deepEqual(source.files.map(f=>f.level),Array.from({length:15},(_,i)=>i+1));
 for(const file of source.files){
  const bytes=fs.readFileSync(new URL(file.path,base));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.ok([4,6].includes(bytes[25]),`${file.path} must retain an alpha channel`);
 }
});
test('250 copied assets match the pinned repository manifest and exclude 4K LN',()=>{
 const base=new URL('../public/vendor/mania-tracker-dans/',import.meta.url);
 const source=JSON.parse(fs.readFileSync(new URL('SOURCE.json',base)));
 assert.equal(source.files.length,250);
 for(const file of source.files){assert.match(file.path,/^(?:reform|7k)\//);
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file.path,base))).digest('hex'),file.sha256);}
 assert.match(fs.readFileSync(new URL('LICENSE',base),'utf8'),/Copyright \(c\) 2026 aleju03/);
});
