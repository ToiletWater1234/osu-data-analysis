// Local-only parsers. Legacy layouts: https://github.com/ppy/osu/wiki/Legacy-database-file-structure
export function md5(buffer) {
  const input = new Uint8Array(buffer), length = input.length;
  const bytes = new Uint8Array(Math.ceil((length + 9) / 64) * 64); bytes.set(input); bytes[length] = 128;
  const view = new DataView(bytes.buffer); view.setBigUint64(bytes.length - 8, BigInt(length) * 8n, true);
  const shifts = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  const constants = Array.from({length:64}, (_,i) => Math.floor(Math.abs(Math.sin(i+1)) * 2 ** 32) | 0);
  let a=0x67452301,b=0xefcdab89|0,c=0x98badcfe|0,d=0x10325476;
  for(let offset=0;offset<bytes.length;offset+=64){
    let aa=a,bb=b,cc=c,dd=d;
    for(let i=0;i<64;i++){
      const group=i>>4;
      const f=group===0?(bb&cc)|(~bb&dd):group===1?(dd&bb)|(~dd&cc):group===2?bb^cc^dd:cc^(bb|~dd);
      const g=group===0?i:group===1?(5*i+1)%16:group===2?(3*i+5)%16:7*i%16;
      const sum=(aa+f+constants[i]+view.getInt32(offset+g*4,true))|0;
      const shift=shifts[group*4+i%4]; const next=(bb+((sum<<shift)|(sum>>>(32-shift))))|0;
      aa=dd;dd=cc;cc=bb;bb=next;
    }
    a=(a+aa)|0;b=(b+bb)|0;c=(c+cc)|0;d=(d+dd)|0;
  }
  return [a,b,c,d].map(n=>Array.from({length:4},(_,i)=>((n>>>(i*8))&255).toString(16).padStart(2,'0')).join('')).join('');
}
class Reader {
  constructor(buffer){this.view=new DataView(buffer);this.offset=0;this.decoder=new TextDecoder();}
  need(n){if(!Number.isSafeInteger(n)||n<0||this.offset+n>this.view.byteLength)throw Error('数据库已截断或版本不受支持。');}
  skip(n){this.need(n);this.offset+=n;}
  u8(){this.need(1);return this.view.getUint8(this.offset++);}
  u16(){this.need(2);const n=this.view.getUint16(this.offset,true);this.offset+=2;return n;}
  i32(){this.need(4);const n=this.view.getInt32(this.offset,true);this.offset+=4;return n;}
  count(){const n=this.i32();if(n<0||n>2_000_000)throw Error('数据库记录数无效。');return n;}
  u64(){this.need(8);const n=this.view.getBigUint64(this.offset,true);this.offset+=8;return n;}
  string(){const marker=this.u8();if(!marker)return '';if(marker!==11)throw Error('数据库字符串无效。');let n=0,s=0,v;do{v=this.u8();n+=(v&127)*2**s;s+=7;if(s>35)throw Error('数据库字符串过长。');}while(v&128);this.need(n);const text=this.decoder.decode(new Uint8Array(this.view.buffer,this.offset,n));this.offset+=n;return text;}
}
export function parseScoresDatabase(buffer){
  const r=new Reader(buffer);const version=r.i32();if(version<20140721||version>20991231)throw Error('仅支持较新的 osu!stable scores.db。');
  const maps=r.count(),scores=[];
  for(let i=0;i<maps;i++){
    const mapHash=r.string();const count=r.count();
    for(let j=0;j<count;j++){
      const mode=r.u8();r.i32();const hash=r.string()||mapHash;const username=r.string();r.string();
      const great=r.u16(),good=r.u16(),meh=r.u16(),perfect=r.u16(),ok=r.u16(),miss=r.u16();
      const totalScore=r.i32()>>>0;r.u16();r.u8();const modBits=r.i32()>>>0;r.string();const ticks=r.u64();
      if(r.i32()!==-1)throw Error('scores.db 记录格式不受支持。');
      const onlineId=r.u64().toString();if(modBits&0x800000)r.skip(8);
      if(mode!==3)continue;
      const total=great+good+meh+perfect+ok+miss;
      const accuracy=total?(300*(perfect+great)+200*ok+100*good+50*meh)/(300*total):0;
      scores.push({hash,username,accuracy,modBits,totalScore,onlineId,hitCount:total,misses:miss,statistics:{great,good:ok,meh,perfect,ok:good,miss},endedAt:Number((ticks-621355968000000000n)/10000n)});
    }
  }
  return scores;
}
export function parseBeatmapDatabase(buffer){
  const r=new Reader(buffer),version=r.i32();if(version<20140609||version>20991231)throw Error('仅支持较新的 osu!.db。');
  r.i32();r.u8();r.skip(8);r.string();const count=r.count(),maps=[];
  for(let i=0;i<count;i++){
    if(version<20191106)r.i32();
    const strings=Array.from({length:9},()=>r.string());const status=r.u8();r.skip(6+8+16+8);
    for(let mode=0;mode<4;mode++)r.skip(r.count()*(version>=20250107?10:14));
    r.skip(12);r.skip(r.count()*17);const id=r.i32(),setId=r.i32();r.i32();r.skip(4+2+4);const mode=r.u8();
    r.string();r.string();r.skip(2);r.string();r.skip(1+8+1);const folder=r.string();r.skip(8+5+4+1);
    maps.push({hash:strings[7],filename:strings[8],folder,id,setId,mode,status:({1:'unsubmitted',2:'graveyard',4:'ranked',5:'approved',6:'qualified',7:'loved'})[status]||'unknown'});
  }
  return maps;
}
export function parseLocalMetadata(text,path,hash){
  if(!/^\uFEFF?osu file format v\d+/.test(text))return null;
  const fields={};let section='';
  for(const line of text.split(/\r?\n/)){
    const heading=line.match(/^\s*\[([^\]]+)\]/);if(heading){section=heading[1];if(section==='HitObjects')break;continue;}
    if(!['Metadata','General','Difficulty'].includes(section))continue;
    const item=line.match(/^([^:]+):(.*)$/);if(item)fields[item[1].trim()]=item[2].trim();
  }
  return {path,hash,id:Math.max(0,Number(fields.BeatmapID)||0),setId:Math.max(0,Number(fields.BeatmapSetID)||0),title:fields.TitleUnicode||fields.Title||path,artist:fields.ArtistUnicode||fields.Artist||'',creator:fields.Creator||'',version:fields.Version||'',mode:Number(fields.Mode||0),keys:Number(fields.CircleSize||0),status:'unknown'};
}
export function directoryParts(path){
  if(!path.trim())return [];
  if(/^[a-z]:|^[/\\]|^[a-z]+:/i.test(path))throw Error('完整路径请粘贴到系统目录选择器的地址栏，然后选择该目录。');
  const parts=path.replaceAll('\\','/').split('/').filter(Boolean);
  if(parts.some(p=>p==='.'||p==='..'))throw Error('子目录不能包含 . 或 ..。');return parts;
}
export async function locateSongs(root,relative=''){
  const parts=directoryParts(relative);
  if(parts.length){let result=root;for(const part of parts)result=await result.getDirectoryHandle(part);return {songs:result,installation:root};}
  if(root.name.toLowerCase()==='songs')return {songs:root,installation:null};
  for(const candidate of [['osu','Songs'],['osu!','Songs'],['Songs']]){
    try{let current=root,installation=root;for(const part of candidate){installation=current;current=await current.getDirectoryHandle(part);}return {songs:current,installation};}catch(error){if(!['NotFoundError','TypeMismatchError'].includes(error.name))throw error;}
  }
  return {songs:root,installation:root};
}
export function localMods(bits){
  return [[1,'NF'],[2,'EZ'],[4,'TD'],[8,'HD'],[16,'HR'],[32,'SD'],[64,'DT'],[128,'RX'],[256,'HT'],[512,'NC'],[1024,'FL'],[2048,'AT'],[4096,'SO'],[8192,'AP'],[16384,'PF'],[32768,'4K'],[65536,'5K'],[131072,'6K'],[262144,'7K'],[524288,'8K'],[1048576,'FI'],[2097152,'RD'],[4194304,'CN'],[8388608,'TP'],[16777216,'9K'],[33554432,'CO'],[67108864,'1K'],[134217728,'3K'],[268435456,'2K'],[536870912,'V2'],[1073741824,'MR']].filter(([bit])=>bits&bit).map(([,name])=>name);
}
export function selectLocalScores(entries,records,user,keys='all'){
  if(!user||!/^\d+$/.test(String(user.id))||Number(user.id)<=0||typeof user.username!=='string'||!user.username.trim())return [];
  const names=new Set([user.username,...(Array.isArray(user.previousUsernames)?user.previousUsernames:[])].filter(name=>typeof name==='string'&&name.trim()).map(name=>name.trim().toLowerCase()));
  const charts=new Map(entries.map(e=>[e.hash,e]));const selected=[];const seen=new Set();
  for(const record of records){
    const recordedId=record.userId??record.user_id;
    if(recordedId!==undefined&&String(recordedId)!==String(user.id))continue;
    if(typeof record.username!=='string'||!names.has(record.username.trim().toLowerCase())||!record.hitCount)continue;
    const entry=charts.get(record.hash);if(!entry||entry.mode!==3||!['loved','graveyard','pending','wip','unsubmitted','unknown'].includes(entry.status))continue;
    if(keys!=='all'&&entry.keys!==Number(keys.replace('k','')))continue;
    if(record.hitCount<(entry.noteCount||0))continue;
    const mods=localMods(record.modBits);
    if(mods.some(m=>['AT','RX','AP','CN','CO','TP','RD','1K','2K','3K','4K','5K','6K','7K','8K','9K'].includes(m)))continue;
    const key=entry.hash+':'+record.modBits+':'+JSON.stringify(record.statistics||{accuracy:record.accuracy});
    if(!seen.has(key)){seen.add(key);selected.push({...record,mods,entry});}
  }
  return selected;
}
