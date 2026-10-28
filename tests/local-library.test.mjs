import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {md5,parseScoresDatabase,parseBeatmapDatabase,parseLocalMetadata,directoryParts,locateSongs,selectLocalScores} from '../public/local-library-core.js';
import {collectAnalysisSamples,mergeScoredSamples} from '../public/analysis-samples.js';
import {buildAnalysis} from '../functions/_shared/profile.js';
class Binary {
  parts=[];
  num(value,bytes){const b=Buffer.alloc(bytes);if(bytes===8)b.writeBigUInt64LE(BigInt(value));else if(bytes===4)b.writeInt32LE(value);else if(bytes===2)b.writeUInt16LE(value);else b.writeUInt8(value);this.parts.push(b);return this;}
  zeros(n){this.parts.push(Buffer.alloc(n));return this;}
  str(text){const b=Buffer.from(text);if(!b.length)return this.num(0,1);this.num(11,1);let n=b.length;do{this.num((n&127)|(n>127?128:0),1);n>>>=7;}while(n);this.parts.push(b);return this;}
  buffer(){const b=Buffer.concat(this.parts);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
}
test('local MD5 matches native crypto for UTF-8, boundaries and multi-block files',()=>{
  for(const text of ['', 'abc','谱面 😀',...Array.from({length:140},(_,n)=>'x'.repeat(n))]){const b=new TextEncoder().encode(text);assert.equal(md5(b.buffer),createHash('md5').update(b).digest('hex'));}
});
test('scores.db decodes judgement counts, usernames, mods and exact map hashes; truncation fails',()=>{
  const b=new Binary().num(20260101,4).num(1,4).str('abcdef').num(1,4);
  b.num(3,1).num(20260101,4).str('abcdef').str('玩家').str('replay');
  for(const n of [5,3,2,80,8,2])b.num(n,2);
  b.num(999999,4).num(200,2).num(0,1).num(64,4).str('').num(621355968000000000n,8).num(-1,4).num(123456789123456789n,8);
  const data=b.buffer(),[s]=parseScoresDatabase(data);
  assert.equal(s.username,'玩家');assert.equal(s.hash,'abcdef');assert.equal(s.hitCount,100);assert.equal(s.accuracy,(85*300+8*200+3*100+2*50)/30000);assert.equal(s.modBits,64);assert.equal(s.onlineId,'123456789123456789');assert.equal(s.statistics.good,8);assert.equal(s.statistics.ok,3);
  assert.throws(()=>parseScoresDatabase(data.slice(0,-2)),/截断/);
});
test('osu!.db supports old double and new float rating tables and retains local map status',()=>{
  for(const version of [20180101,20240101,20260101]){
    const b=new Binary().num(version,4).num(1,4).num(1,1).zeros(8).str('user').num(1,4);
    if(version<20191106)b.num(0,4);
    for(const s of ['artist','','title','','creator','4K','audio.mp3','hash','map.osu'])b.str(s);
    b.num(7,1).zeros(6+8+16+8);
    for(let i=0;i<4;i++)b.num(1,4).zeros(version>=20250107?10:14);
    b.zeros(12).num(1,4).zeros(17).num(123,4).num(456,4).num(0,4).zeros(4+2+4).num(3,1).str('').str('').zeros(2).str('').zeros(1+8+1).str('456 song').zeros(8+5+4+1);
    const [map]=parseBeatmapDatabase(b.buffer());assert.equal(map.status,'loved');assert.equal(map.hash,'hash');assert.equal(map.id,123);assert.equal(map.folder,'456 song');assert.equal(map.mode,3);
  }
});
test('folder resolution prefers osu/Songs over Songs and prevents traversal or absolute-path pretending',async()=>{
  const folder=(name,children={})=>({name,getDirectoryHandle:async key=>{if(children[key])return children[key];throw new DOMException('Missing','NotFoundError');}});
  const preferred=folder('Songs'),root=folder('Games',{osu:folder('osu',{Songs:preferred}),Songs:folder('Songs')});
  assert.equal((await locateSongs(root)).songs,preferred);
  assert.deepEqual(directoryParts('osu\\Songs'),['osu','Songs']);
  assert.throws(()=>directoryParts('../Songs'),/不能/);assert.throws(()=>directoryParts('D:\\osu!\\Songs'),/完整路径/);
});
test('only matching played charts qualify, username and key filters isolate comparisons; ranked charts excluded',()=>{
  const entry={hash:'a',id:1,mode:3,keys:4,status:'graveyard'};
  const records=[{hash:'a',username:'Alice',accuracy:.98,hitCount:100,modBits:0},{hash:'a',username:'Alice',accuracy:.99,hitCount:100,modBits:0},{hash:'a',username:'Bob',accuracy:1,hitCount:100,modBits:0},{hash:'missing',username:'Alice',accuracy:1,hitCount:100,modBits:0},{hash:'a',username:'Alice',accuracy:1,hitCount:100,modBits:2048}];
  const user={id:1,username:'alice',previousUsernames:[]};
  const result=selectLocalScores([entry],records,user,'4k');assert.equal(result.length,2);assert.ok(result.every(s=>s.username==='Alice'));
  assert.equal(selectLocalScores([entry],records,user,'7k').length,0);
  assert.equal(selectLocalScores([{...entry,status:'ranked'}],records,user,'4k').length,0);
  assert.equal(selectLocalScores([entry],[],user,'4k').length,0);
});
test('local identity accepts only the target ID current or official previous usernames and rejects numeric ID conflicts',()=>{
  const entry={hash:'identity',id:123,mode:3,keys:4,status:'loved'};
  const record=(username,accuracy,extra={})=>({hash:'identity',username,accuracy,hitCount:100,modBits:0,...extra});
  const records=[record('CurrentName',.99),record('oldname',.98),record('OldName2',.97,{userId:12}),record('CurrentName',.96,{user_id:13}),record('OtherPlayer',1),record('OldName_extra',1),record('Current Name',1),record(null,1)];
  const user={id:12,username:'CurrentName',previousUsernames:['OldName','OldName2']};
  const selected=selectLocalScores([entry],records,user,'4k');assert.deepEqual(selected.map(s=>s.username),['CurrentName','oldname','OldName2']);
  assert.deepEqual(selectLocalScores([entry],records,{id:13,username:'OtherPlayer',previousUsernames:[]},'4k').map(s=>s.username),['OtherPlayer']);
  for(const invalid of ['CurrentName',{}, {id:12,previousUsernames:['OldName']},{id:0,username:'CurrentName'}])assert.equal(selectLocalScores([entry],records,invalid,'4k').length,0);
});
test('unbound analysis stays on B50 and never queries local metadata',async()=>{
  const scores=Array.from({length:100},(_,i)=>({id:i}));const result=await collectAnalysisSamples({scores,analysisLimit:100},()=>{throw Error('must not fetch');});assert.equal(result.scores.length,50);assert.equal(result.localCount,0);
});
test('base analysis always uses B50 even if a caller requests a larger legacy limit',()=>{
  const raw=Array.from({length:100},(_,i)=>({accuracy:i<50?.99:.9,beatmap:{id:i+1,mode:'mania',cs:4},statistics:{great:100}}));
  const user={id:1,username:'Alice'};
  const a=buildAnalysis(user,raw,[],'mania','4k'),b=buildAnalysis(user,raw,[],'mania','4k',{limit:100});
  assert.equal(a.scores.length,50);assert.equal(b.scores.length,50);assert.equal(a.metrics.accuracy,b.metrics.accuracy);assert.equal(b.analysisLimit,50);
});
test('extra pool keeps only PP top 50 distinct Loved/graveyard charts and excludes duplicate base charts',()=>{
  const score=(id,pp=0)=>({accuracy:.98,calculatedPp:pp,mods:[],beatmap:{id,status:'loved',stars:1000-pp}});
  const base=Array.from({length:100},(_,i)=>score(i+1));
  const extras=Array.from({length:250},(_,i)=>({...score(i+101,i),localSupplement:true}));
  const result=mergeScoredSamples(base,[...extras,{...score(101,999),localSupplement:true},score(1,10000),{...score(999,20000),beatmap:{id:999,status:'pending'}}]);
  assert.equal(result.scores.length,100);assert.equal(result.localCount,50);assert.equal(result.scores[50].beatmap.id,101);assert.equal(result.scores[50].calculatedPp,999);assert.equal(result.scores[51].calculatedPp,249);assert.equal(result.scores.filter(s=>s.beatmap.id===101).length,1);assert.ok(!result.scores.some(s=>s.beatmap.id===999));
});
test('metadata indexing does not claim a ranked status based on a title or ID',()=>{
  const data=parseLocalMetadata('osu file format v14\n[General]\nMode:3\n[Metadata]\nTitle:Ranked\nBeatmapID:123\n[Difficulty]\nCircleSize:4\n','a.osu','hash');assert.equal(data.status,'unknown');assert.equal(data.keys,4);assert.equal(data.id,123);assert.equal(parseLocalMetadata('<html>error</html>','a.osu','hash'),null);
});
