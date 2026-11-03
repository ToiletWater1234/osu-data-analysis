import test from 'node:test';
import assert from 'node:assert/strict';
import {limitSegments} from '../public/segment-limits.js';

test('over 80 adaptive ranges are merged into ten without losing or duplicating timeline coverage',()=>{
 const input=Array.from({length:120},(_,i)=>({from:i*1000,to:(i+1)*1000,rc:i<60?5:10,lnRatio:i<60?0:1}));
 const result=limitSegments(input);assert.equal(result.length,10);assert.equal(result[0].from,0);assert.equal(result.at(-1).to,120000);
 assert.equal(result.reduce((s,p)=>s+p.to-p.from,0),120000);
 for(let i=1;i<result.length;i++)assert.equal(result[i].from,result[i-1].to);
 assert.equal(input.length,120);assert.ok(result.some(r=>r.to===60000));
});
test('ten or fewer ranges preserve cached results and empty charts stay empty',()=>{
 const original=[{from:0,to:1000,rc:4,ln:0}];assert.deepEqual(limitSegments(original),original);
 assert.deepEqual(limitSegments([]),[]);assert.throws(()=>limitSegments(original,0),/上限/);
});
