import {localReady,subscribeLocal,bindLocal,reconnectLocal,disconnectLocal} from './local-library.js';
const panel=document.querySelector('#local-library-panel');
if(panel){
  const bind=panel.querySelector('#local-bind'),rescan=panel.querySelector('#local-rescan'),disconnect=panel.querySelector('#local-disconnect'),input=panel.querySelector('#local-folder-input'),path=panel.querySelector('#local-relative-path'),status=panel.querySelector('#local-status');
  function error(e){if(e.name!=='AbortError'){status.textContent=e.message||'本地目录操作失败。';status.classList.add('local-error');}}
  subscribeLocal(({library,scanning,message})=>{
    bind.disabled=rescan.disabled=disconnect.disabled=scanning;path.disabled=scanning;
    rescan.hidden=!library?.root;disconnect.hidden=!library;
    panel.querySelector('#local-summary').textContent=scanning?'正在扫描…':library?.available?`${library.entries.length} 张 · B50 + 额外 PP 前 50`:library?'需要重新授权 · B50':'未绑定 · 使用 B50';
    if(message){status.textContent=message;status.classList.remove('local-error');}
    if(library&&!path.value)path.value=library.relative||'';
  });
  bind.addEventListener('click',async()=>{
    try{
      if(window.showDirectoryPicker){const root=await window.showDirectoryPicker({id:'osu-songs',mode:'read'});await bindLocal({root,relative:path.value});}
      else input.click();
    }catch(e){error(e);}
  });
  input.addEventListener('change',async()=>{try{if(input.files.length)await bindLocal({files:[...input.files],relative:path.value});}catch(e){error(e);}finally{input.value='';}});
  rescan.addEventListener('click',async()=>{try{await reconnectLocal(path.value);}catch(e){error(e);}});
  disconnect.addEventListener('click',async()=>{try{await disconnectLocal();}catch(e){error(e);}});
  void localReady;
}
