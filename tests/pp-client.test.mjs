import test from 'node:test';
import assert from 'node:assert/strict';
import {createPpCalculator} from '../public/pp-client.js';

function mockWorker(t,Worker){
 const original=Object.getOwnPropertyDescriptor(globalThis,'Worker');
 Object.defineProperty(globalThis,'Worker',{value:Worker,writable:true,configurable:true});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'Worker',original);else delete globalThis.Worker;});
}

test('PP worker failures preserve their actionable codes and allow retrying invalid scores',async t=>{
 const workers=[];
 mockWorker(t,class {
  constructor(){workers.push(this);}
  postMessage(message){this.request=message;}
  terminate(){this.terminated=true;}
 });
 const calculator=createPpCalculator();
 try{
  const init=calculator.calculate('source',{statistics:{perfect:1}});
  workers[0].onmessage({data:{id:1,error:'WebAssembly blocked',code:'PP_INIT_FAILED'}});
  await assert.rejects(init,error=>error.code==='PP_INIT_FAILED'&&error.message==='WebAssembly blocked');
  const invalid=calculator.calculate('source',{statistics:{perfect:1}});
  workers[0].onmessage({data:{id:2,error:'Invalid judgements'}});
  await assert.rejects(invalid,/Invalid judgements/);
  const retry=calculator.calculate('source',{statistics:{perfect:1}});
  workers[0].onmessage({data:{id:3,result:{pp:123,engine:'rosu-pp-js 4.0.1'}}});
  assert.equal((await retry).pp,123);
 }finally{calculator.dispose();}
 assert.equal(workers[0].terminated,true);
});

test('PP worker load errors stop the calculator with a diagnostic code',async t=>{
 let worker;
 mockWorker(t,class {
  constructor(){worker=this;}
  postMessage(){}
  terminate(){}
 });
 const calculator=createPpCalculator();
 const pending=calculator.calculate('source',{});
 worker.onerror();
 await assert.rejects(pending,error=>error.code==='PP_WORKER_FAILED');
 await assert.rejects(calculator.calculate('source',{}),/已停止/);
});
