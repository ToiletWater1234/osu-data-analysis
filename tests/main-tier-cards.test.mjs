import test from 'node:test';
import assert from 'node:assert/strict';
import {mainTierAbilities,renderMainTierCards} from '../public/main-tier-cards.js';
const skill=(keys,name,tier)=>({keys,name,nameZh:keys+'K '+name,tier,confidence:'多图估计',sampleCount:5,evidenceShare:.6,accuracy:.96});
test('main RC and LN tiers are separately rendered without opening a disclosure',()=>{
 const abilities=mainTierAbilities([skill(4,'RC','Alpha mid'),skill(4,'LN','LN 10 mid'),skill(4,'Jacks','Reform 8 mid')],[4]);
 assert.deepEqual(abilities.map(a=>a.name),['4K 常规段位','4K 面条段位']);
 const html=renderMainTierCards(abilities);assert.match(html,/Alpha mid/);assert.match(html,/LN 10 mid/);
 assert.ok(!html.includes('<details'));assert.ok(!html.includes('Reform 8'));assert.match(html,/aria-label="主要段位"/);
});
test('all-key mode groups tiers by key count and retains a visible missing-LN placeholder',()=>{
 const abilities=mainTierAbilities([skill(7,'RC','Gamma mid'),skill(4,'RC','Alpha mid')],[7,4,4]);
 assert.deepEqual(abilities.map(a=>a.name),['4K 常规段位','4K 面条段位','7K 常规段位','7K 面条段位']);
 assert.equal(abilities[1].value,'暂无可用成绩');assert.equal(abilities.length,4);
});
test('tier text is escaped, including below-table labels, and non-mania has no empty cards',()=>{
 assert.equal(renderMainTierCards(undefined),'');
 const html=renderMainTierCards([{name:'<img src=x onerror=1>',value:'< LN 5 mid',note:'<script>bad</script>',kind:'LN'}]);
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt; LN 5 mid/);
});
