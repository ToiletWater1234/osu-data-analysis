import {initPp,calculateScorePp} from './pp-engine.js';
self.onmessage=async({data})=>{
  try{await initPp();}
  catch(error){self.postMessage({id:data.id,code:'PP_INIT_FAILED',error:'PP 模块初始化失败：'+(error.message||'WebAssembly 无法加载。')});return;}
  try{self.postMessage({id:data.id,result:calculateScorePp(data.source,data.score)});}
  catch(error){self.postMessage({id:data.id,error:error.message||'无法复算成绩 PP。'});}
};
