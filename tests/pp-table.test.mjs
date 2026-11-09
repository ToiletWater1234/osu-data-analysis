import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fetchPpTableRow} from '../functions/_shared/pp-table.js';
import {onRequestGet} from '../functions/api/beatmaps/table-row.js';
import {buildCatchRow,catchModConflicts,CTB_MOD_CHOICES,parseCatchMods} from '../public/ctb-table.js';
import {buildManiaTableRow,ppTableHtml,ppTableTsv,maniaTargetSheet} from '../public/pp-table.js';
import {renderPpMapTools} from '../public/pp-table-ui.js';

const map={id:123,mode:'fruits',beatmapset_id:456,difficulty_rating:4.239,bpm:180,total_length:208,version:'Rain',beatmapset:{id:456,title:'title & <name>'}};

test('auto-detect CTB and send the entire EZ+DT+FL combination to official attributes',async()=>{
  const calls=[];
  const row=await fetchPpTableRow(async(path,options)=>{calls.push({path,options});return options?{attributes:{star_rating:3.789}}:map;},123,'FL+DT+EZ');
  assert.equal(row.mode,'fruits'); assert.equal(row.mod,'EZDTFL');
  assert.deepEqual(JSON.parse(calls[1].options.body),{ruleset:'fruits',mods:['EZ','DT','FL']});
  assert.equal(calls[1].options.method,'POST');
  assert.deepEqual(row.row,[123,'title & <name>','Rain','★3.78','2:19','270.00','EZDTFL','']);
  assert.equal(ppTableTsv(row).split('\t')[4],"'2:19");
});

test('NM means no mods, and no star estimate replaces a missing or failed official result',async()=>{
  let body;
  const row=await fetchPpTableRow(async(_,options)=>{if(!options)return map;body=JSON.parse(options.body);return {attributes:{star_rating:4.239}};},123,'');
  assert.deepEqual(body,{ruleset:'fruits',mods:[]}); assert.equal(row.row[6],'');
  await assert.rejects(fetchPpTableRow(async(_,options)=>options?{attributes:{}}:map,123,'DT'),{status:502});
  await assert.rejects(fetchPpTableRow(async(_,options)=>{if(options)throw Error('offline');return map;},123,'DT'),/offline/);
});

test('CTB ID exports as a blue integer rather than text without changing mania IDs',()=>{
  const row=buildCatchRow({...map,id:'000123'},{star_rating:4.239});
  assert.equal(row.row[0],123);
  assert.equal(typeof row.row[0],'number');
  for(const value of [123,'000123']) {
    const data={...row,row:[value,...row.row.slice(1)]};
    const cell=ppTableHtml(data).match(/<td\b[^>]*>[\s\S]*?<\/td>/)[0];
    const opening=cell.slice(0,cell.indexOf('>'));
    assert.match(opening,/x:num="123" data-type="number"/);
    assert.match(opening,/mso-number-format:'0'/);
    assert.match(opening,/color:#0073A7/);
    assert.doesNotMatch(opening,/x:str|\\@/);
    assert.match(cell,/<a[^>]+color:#0073A7[^>]*>123<\/a>/);
    assert.equal(ppTableTsv(data).split('\t')[0],'123');
  }
  const mania=buildManiaTableRow({...map,mode:'mania'},6.239);
  assert.equal(typeof mania.row[0],'string');
  assert.equal(mania.row[0],'123');
});

test('mania reuses original seven columns, rounding, duration and target sheet rules',async()=>{
  const mania={...map,mode:'mania',difficulty_rating:6.239};
  const row=await fetchPpTableRow(async()=>mania,123,'NM');
  assert.equal(row.mode,'mania'); assert.equal(row.row.length,7); assert.equal(row.row[3],'★6.24');
  assert.equal(row.targetSheet,'6~6.5'); assert.equal(row.row[4],'3:28'); assert.equal(row.row[6],'');
  assert.equal(ppTableTsv(row).split('\t').length,7);
  assert.equal([...ppTableHtml(row).matchAll(/<td\b/g)].length,7);
  let body;
  const dt=await fetchPpTableRow(async(_,options)=>{if(!options)return mania;body=JSON.parse(options.body);return {attributes:{star_rating:8.271}};},123,'DT');
  assert.deepEqual(body,{ruleset:'mania',mods:['DT']}); assert.equal(dt.row[3],'★8.27');assert.equal(dt.row[5],'270');
  for(const [stars,sheet] of [[4.99,''],[5,'5~5.5'],[5.5,'5.5~6'],[9.99,'9.5~10'],[10,'10+']])assert.equal(maniaTargetSheet(stars),sheet);
  assert.throws(()=>buildManiaTableRow(mania,NaN,'NM'));
});

test('all CTB conflict pairs are rejected before any API call',async()=>{
  for(let mask=0;mask<2**CTB_MOD_CHOICES.length;mask++){
    const selected=CTB_MOD_CHOICES.filter((_,i)=>mask&(1<<i)).map(mod=>mod.acronym);
    const invalid=selected.some(mod=>catchModConflicts(mod,selected).length);
    if(invalid)await assert.rejects(fetchPpTableRow(()=>{throw Error('must not fetch');},123,selected.join('')),{status:400});
    else assert.doesNotThrow(()=>parseCatchMods(selected.join('')));
  }
  await assert.rejects(fetchPpTableRow(async()=>({...map,mode:'osu'}),123,'NM'),{status:400});
  for(const id of ['1x',0,-1,Infinity,'9007199254740992'])await assert.rejects(fetchPpTableRow(()=>{},id,'NM'),{status:400});
});

test('CTB copies retain eight cells and a blank review, with no body fill except star color',()=>{
  const data=buildCatchRow(map,{star_rating:4.239});
  {
    const html=ppTableHtml(data);
    const cells=[...html.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/g)].map(match=>match[0]);
    assert.equal(cells.length,8);assert.equal(ppTableTsv(data).split('\t')[7],'');
    for(const [index,cell] of cells.entries()){
      if(index===3)assert.match(cell,/background-color:/);
      else assert.doesNotMatch(cell,/bgcolor=|background(?:-color)?:/);
    }
    assert.match(cells[7],/x:str="" data-type="text"/);
    assert.match(cells[7],/font-size:18pt/);assert.match(cells[7],/><\/td>$/);
    assert.ok(html.includes('&amp; &lt;name&gt;'));
  }
  data.row[7]='较难 <>&';data.hard=true;
  assert.doesNotMatch(ppTableHtml(data),/#FFF4DC|#F3F7FB/);assert.ok(ppTableHtml(data).includes('较难 &lt;&gt;&amp;'));
});

test('website only offers format generation for native mania and CTB maps',()=>{
  assert.match(renderPpMapTools({...map,stars:4.2,url:'https://osu.ppy.sh/beatmaps/123'}),/ctb-mod-picker/);
  assert.match(renderPpMapTools({...map,mode:'mania',stars:4.2}),/mania-table-mod/);
  for(const mode of ['osu','taiko'])assert.ok(!renderPpMapTools({...map,mode,stars:4.2}).includes('data-pp-generate'));
});

test('row endpoint requires login, preserves OAuth settings and validates conflicts',async()=>{
  const env={SESSIONS:{get:async()=>null}};
  const request=new Request('https://site.test/api/beatmaps/table-row?id=123&mods=EZDTFL');
  assert.equal((await onRequestGet({request,env})).status,401);
  const authenticated={SESSIONS:{get:async()=>({accessToken:'test-only',expiresAt:Date.now()+600000})}};
  const rejected=await onRequestGet({request:new Request('https://site.test/api/beatmaps/table-row?id=123&mods=EZHR',{headers:{cookie:'osu_toolbox_session=test'}}),env:authenticated});
  assert.equal(rejected.status,400);
  const previous=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json(String(url).endsWith('/attributes')?{attributes:{star_rating:3.7}}:map);};
  try{
    const result=await onRequestGet({request:new Request(request,{headers:{cookie:'osu_toolbox_session=test'}}),env:authenticated});
    assert.equal(result.status,200);assert.equal((await result.json()).row.length,8);
    assert.equal(calls[1].options.headers.authorization,'Bearer test-only');
    assert.deepEqual(JSON.parse(calls[1].options.body),{ruleset:'fruits',mods:['EZ','DT','FL']});
  }finally{globalThis.fetch=previous;}
});

test('homepage keeps 4K and CTB links side by side and has no separate CTB workspace',async()=>{
  const html=await fs.readFile(new URL('../templates/home.html',import.meta.url),'utf8');
  assert.match(html,/pp-list-grid/);assert.match(html,/DV0tHRUdvdHZpVEtZ/);assert.match(html,/DV1lNdW5YSXBjR1Bv\?tab=BB08J2/);
  const tool=await fs.readFile(new URL('../templates/beatmap.html',import.meta.url),'utf8');
  assert.ok(!tool.includes('ctb-table-panel'));
});
