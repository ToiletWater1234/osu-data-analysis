import { getSession } from '../../_shared/auth.js';
import { getMapFacts } from '../../_shared/map-facts.js';
import { readJson,json,errorResponse } from '../../_shared/response.js';
export async function onRequestPost({request,env}){
  try{const session=await getSession(request,env,{required:true});const body=await readJson(request);
    if(!Array.isArray(body.ids)||body.ids.length>50||body.ids.some(id=>!Number.isSafeInteger(id)||id<=0))throw Object.assign(Error('一次最多查询 50 个有效谱面 ID。'),{status:400});
    return json({beatmaps:await getMapFacts(env,session,[...new Set(body.ids)])});
  }catch(error){return errorResponse(error);}
}
