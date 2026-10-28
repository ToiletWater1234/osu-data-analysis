import {initPp,calculateScorePp} from './pp-engine.js';
self.onmessage=async({data})=>{
  try{await initPp();self.postMessage({id:data.id,result:calculateScorePp(data.source,data.score)});}
  catch(error){self.postMessage({id:data.id,error:error.message||'无法复算成绩 PP。'});}
};
