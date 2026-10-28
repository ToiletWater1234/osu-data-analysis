import { md5, selectLocalScores } from './local-library-core.js';
const DB_NAME='osu-analysis-local-library';
let library=null,temporaryFiles=null,scanning=false;
const subscribers=new Set();
function emit(message){for(const callback of subscribers)callback({library,scanning,message});}
async function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore('binding');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function storage(operation,value){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('binding',operation==='get'?'readonly':'readwrite');const store=tx.objectStore('binding');const req=operation==='get'?store.get('current'):operation==='delete'?store.delete('current'):store.put(value,'current');let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
async function restore(){
  try{const saved=await storage('get');if(saved?.songs){const granted=await saved.songs.queryPermission({mode:'read'})==='granted';const current=saved.schemaVersion===2;library={...saved,available:granted&&current};emit(!current?'本地判定数据格式已更新，请点击“重新扫描 / 授权”后使用 PP 筛选。':granted?'已恢复本地目录。':'目录已记住，请点击“重新扫描 / 授权”恢复读取。');}}
  catch{emit('当前浏览器无法保存目录绑定；本次仍可使用文件夹选择。');}
}
export const localReady=typeof indexedDB==='undefined'?Promise.resolve():restore();
export function isLocalBound(){return Boolean(library?.available&&library.entries.length);}
export function subscribeLocal(callback){subscribers.add(callback);callback({library,scanning});return ()=>subscribers.delete(callback);}
export async function bindLocal({root,files,relative=''}){
  if(scanning)throw Error('正在扫描，请稍候。');scanning=true;emit('正在索引本地谱面和成绩…');
  try{
    const result=await new Promise((resolve,reject)=>{const worker=new Worker(new URL('./local-index-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.error){worker.terminate();reject(Error(data.error));}else if(data.result){worker.terminate();resolve(data.result);}else emit(`已扫描 ${data.progress} 个文件，找到 ${data.found} 张谱面…`);};worker.onerror=()=>{worker.terminate();reject(Error('本地索引模块加载失败，请刷新重试。'));};worker.postMessage({root,files:files?.map(file=>({file,path:file.webkitRelativePath})),relative});});
    if(!result.entries.length)throw Error('所选目录没有找到有效 .osu 文件，请选择 osu! 安装目录或 Songs。');
    const next={...result,root,schemaVersion:2,name:root?.name||files?.[0]?.webkitRelativePath.split('/')[0]||'本地目录',relative,available:true,updatedAt:Date.now()};
    if(root){try{await storage('put',next);}catch{next.warnings.push('目录记忆不可用，关闭页面后需重新绑定。');}}
    else {try{await storage('delete');}catch{} }
    library=next;temporaryFiles=files||null;
    emit(`已绑定 ${next.entries.length} 张谱面、${next.scores.length} 条 mania 本地成绩${next.skipped?`；跳过 ${next.skipped} 个无效或超过 2 MB 的文件`:''}。${next.warnings.join(' ')}`);
  }finally{scanning=false;emit();}
}
export async function reconnectLocal(relative=library?.relative){
  if(!library?.root)throw Error('请重新浏览并选择文件夹。');
  const permission=await library.root.requestPermission({mode:'read'});if(permission!=='granted')throw Error('目录读取尚未授权。');
  await bindLocal({root:library.root,relative});
}
export async function disconnectLocal(){try{await storage('delete');}finally{library=null;temporaryFiles=null;emit('已解除绑定并清除本站保存的本地索引。');}}
export function searchLocal(query){
  if(!isLocalBound())throw Error('请先展开“本地 osu! 文件夹”并绑定目录。');
  const id=query.match(/(?:beatmaps\/|#\w+\/)(\d+)/i)?.[1]||(/^\d+$/.test(query)?query:null);
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return library.entries.filter(e=>id?e.id===Number(id):terms.every(term=>`${e.title} ${e.artist} ${e.creator} ${e.version} ${e.path}`.toLowerCase().includes(term)));
}
export async function readLocalEntry(entry){
  if(!isLocalBound())throw Error('本地目录未授权。');
  let file;
  if(library.songs){let handle=library.songs;const parts=entry.path.split('/');for(const part of parts.slice(0,-1))handle=await handle.getDirectoryHandle(part);file=await(await handle.getFileHandle(parts.at(-1))).getFile();}
  else file=temporaryFiles?.find(f=>f.webkitRelativePath.split('/').slice(1).join('/')===library.prefix+entry.path);
  if(!file)throw Error('本地文件已移动，请重新扫描。');
  if(file.size>2_000_000)throw Error('谱面超过 2 MB 分析限制。');
  const buffer=await file.arrayBuffer();if(md5(buffer)!==entry.hash)throw Error('谱面版本已变化，请重新扫描后分析。');
  return new TextDecoder().decode(buffer);
}
export async function findLocalSource(id,checksum){
  if(!isLocalBound())return null;
  const candidates=library.entries.filter(e=>e.id===Number(id)&&(!checksum||e.hash===checksum));
  // Without a checksum, two revisions sharing an ID cannot be matched safely.
  if(candidates.length!==1)return null;
  return {source:await readLocalEntry(candidates[0]),cached:true,local:true};
}
export function localScoreCandidates(user,keys){
  if(!isLocalBound())return [];
  return selectLocalScores(library.entries,library.scores,user,keys);
}
export function setLocalFacts(facts){
  const byId=new Map(facts.map(f=>[f.id,f]));
  for(const entry of library?.entries||[]){const fact=byId.get(entry.id);if(fact){entry.statusVerified=true;entry.status=fact.checksum&&fact.checksum!==entry.hash?'revision-mismatch':fact.status;}}
}
export function localUnknownIds(user,keys){return [...new Set(localScoreCandidates(user,keys).filter(s=>!s.entry.statusVerified&&['unknown','graveyard','loved'].includes(s.entry.status)&&s.entry.id>0).map(s=>s.entry.id))];}
