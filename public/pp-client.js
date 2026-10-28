export function createPpCalculator(){
  let worker=null,id=0,pending=null,stopped=false;
  function stop(error){stopped=true;worker?.terminate();worker=null;if(pending){clearTimeout(pending.timer);pending.reject(error);pending=null;}}
  return {
    calculate(source,score){
      if(stopped)return Promise.reject(Error('PP 计算模块已停止。'));
      if(pending)return Promise.reject(Error('已有 PP 计算正在进行。'));
      worker ||= new Worker(new URL('./pp-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{if(!pending||data.id!==pending.id)return;const request=pending;pending=null;clearTimeout(request.timer);data.error?request.reject(Error(data.error)):request.resolve(data.result);};
      worker.onerror=()=>stop(Error('PP 计算模块加载失败，请刷新重试。'));
      return new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>stop(Error('PP 计算超时。')),30000);pending={id:requestId,resolve,reject,timer};worker.postMessage({id:requestId,source,score:{statistics:score.statistics,client:score.client,mods:score.mods,modDetails:score.modDetails}});});
    },
    dispose(){stop(Error('PP 计算已结束。'));},
  };
}
