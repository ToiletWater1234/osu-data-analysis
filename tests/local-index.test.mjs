import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
test('index worker reads only osu/database files, resolves Songs and never uploads or runs difficulty calculations',async()=>{
  const messages=[],reads=[];const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Local indexing must never use the network');};
  globalThis.self={postMessage:data=>messages.push(data)};
  const file=(name,text)=>({kind:'file',getFile:async()=>{reads.push(name);const bytes=Buffer.from(text);return {size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)};}});
  const directory=(name,children)=>({name,kind:'directory',getDirectoryHandle:async key=>{if(children[key]?.kind==='directory')return children[key];throw new DOMException('Missing','NotFoundError');},getFileHandle:async key=>{if(children[key]?.kind==='file')return children[key];throw new DOMException('Missing','NotFoundError');},async *entries(){yield* Object.entries(children);}});
  const text='osu file format v14\n[General]\nMode:3\n[Metadata]\nTitle:Local only\nBeatmapID:-1\n[Difficulty]\nCircleSize:4\n[HitObjects]\n64,192,1000,1,0,0:0:0:0:\n';
  const songs=directory('Songs',{'map folder':directory('map folder',{'map.osu':file('map.osu',text),'audio.mp3':file('audio.mp3','audio'),'cover.jpg':file('cover.jpg','cover')})});
  const root=directory('osu!',{Songs:songs,'private.txt':file('private.txt','secret')});
  try{
    await import('../public/local-index-worker.js');
    await self.onmessage({data:{root,relative:''}});
    const result=messages.at(-1).result;assert.ok(result);assert.equal(result.entries.length,1);assert.equal(result.entries[0].noteCount,1);assert.equal(result.entries[0].status,'unsubmitted');assert.equal(result.entries[0].hash,createHash('md5').update(text).digest('hex'));assert.deepEqual(reads,['map.osu']);assert.equal(result.scores.length,0);assert.equal(result.songs,songs);assert.equal(result.entries[0].source,undefined);
  }finally{globalThis.fetch=originalFetch;delete globalThis.self;}
});
