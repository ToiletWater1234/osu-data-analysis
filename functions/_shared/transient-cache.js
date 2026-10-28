// Disposable public-data caches do not consume persistent KV operations.
const origin='https://osu-data-analysis.cn';
function key(name){return new Request(origin+'/api/__transient/'+encodeURIComponent(name));}
export async function readTransient(name){
  try{const response=await globalThis.caches?.default?.match(key(name));return response?await response.json():null;}catch{return null;}
}
export async function writeTransient(name,data,ttl){
  try{if(!globalThis.caches?.default)return false;await caches.default.put(key(name),new Response(JSON.stringify(data),{headers:{'content-type':'application/json','cache-control':`public, max-age=${ttl}`}}));return true;}catch{return false;}
}
