import { locateSongs, directoryParts, md5, parseLocalMetadata, parseScoresDatabase, parseBeatmapDatabase } from './local-library-core.js';
const MAX_FILE=2_000_000;
async function readDatabase(get,name,parser,warnings){
  try{const file=await get(name);if(file.size>256_000_000)throw Error('文件超过 256 MB。');return parser(await file.arrayBuffer());}
  catch(error){if(error.name!=='NotFoundError')warnings.push(name+'：'+error.message);return [];}
}
async function* walk(handle,prefix='',depth=0){
  if(depth>12)return;
  for await(const [name,child] of handle.entries()){
    const path=prefix+name;
    if(child.kind==='directory'){if(!['.git','node_modules','$RECYCLE.BIN'].includes(name))yield* walk(child,path+'/',depth+1);}
    else if(name.toLowerCase().endsWith('.osu'))yield {path,get:()=>child.getFile()};
  }
}
self.onmessage=async({data})=>{
  try{
    const warnings=[];let iterable,getDatabase,songs,installation;
    if(data.root){
      ({songs,installation}=await locateSongs(data.root,data.relative));
      iterable=walk(songs);
      getDatabase=async name=>{if(!installation)throw new DOMException('请选择安装目录以读取成绩库。','NotFoundError');return (await installation.getFileHandle(name)).getFile();};
    }else{
      const files=data.files;const relative=directoryParts(data.relative).join('/');
      const normalized=files.map(({file,path})=>({file,path:path.split('/').slice(1).join('/')}));
      const lower=p=>p.toLowerCase();
      const prefix=relative?relative+'/':['osu/Songs/','osu!/Songs/','Songs/'].find(p=>normalized.some(x=>lower(x.path).startsWith(lower(p))))||'';
      const parent=prefix?prefix.slice(0,prefix.slice(0,-1).lastIndexOf('/')+1):'';
      iterable=normalized.filter(x=>x.path.toLowerCase().endsWith('.osu')&&lower(x.path).startsWith(lower(prefix))).map(x=>({path:x.path.slice(prefix.length),get:async()=>x.file}));
      getDatabase=async name=>{const found=normalized.find(x=>lower(x.path)===lower(parent+name));if(!found)throw new DOMException('Not found','NotFoundError');return found.file;};
      data.prefix=prefix;
    }
    const db=await readDatabase(getDatabase,'osu!.db',parseBeatmapDatabase,warnings);
    const scores=await readDatabase(getDatabase,'scores.db',parseScoresDatabase,warnings);
    const facts=new Map(db.map(e=>[e.hash,e]));const entries=[];let skipped=0,scanned=0;
    for await(const item of iterable){
      try{
        const file=await item.get();if(file.size>MAX_FILE){skipped++;continue;}
        const buffer=await file.arrayBuffer(),text=new TextDecoder().decode(buffer),hash=md5(buffer);
        const entry=parseLocalMetadata(text,item.path,hash);
        if(entry){const fact=facts.get(hash);if(fact)entry.status=fact.status;else if(!entry.id)entry.status='unsubmitted';entry.noteCount=(text.split(/\[HitObjects\]\s*/)[1]||'').split(/\r?\n/).filter(s=>/^\d+,\d+,\d+,\d+,/.test(s)).length;entries.push(entry);}
        else skipped++;
      }catch{skipped++;}
      if(++scanned%25===0)self.postMessage({progress:scanned,found:entries.length});
    }
    self.postMessage({result:{entries,scores,warnings,skipped,songs,installation,prefix:data.prefix||''}});
  }catch(error){self.postMessage({error:error.message||'无法扫描所选目录。'});}
};
