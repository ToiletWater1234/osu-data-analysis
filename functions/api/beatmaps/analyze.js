import { getSession } from '../../_shared/auth.js';
import { errorResponse, json, readJson } from '../../_shared/response.js';
import { getOsuSource } from '../../_shared/osu-files.js';
import { getMapFacts } from '../../_shared/map-facts.js';

export async function onRequestPost({ request, env }) {
  try {
    const session = await getSession(request, env, { required: true });
    const body = await readJson(request);
    const id = String(body.id || '');
    if (!/^\d{1,12}$/.test(id)) throw Object.assign(new Error('谱面 ID 无效。'), { status: 400 });
    const facts = await getMapFacts(env, session, [Number(id)],{contextKey:body.contextKey});
    const file = await getOsuSource(env, id, {status:facts[0]?.status});
    if (!/^Mode\s*:\s*3\s*$/m.test(file.source)) throw Object.assign(new Error('下载内容不是有效的 osu!mania 谱面。'), { status: 422 });
    return json(file);
  } catch (error) { return errorResponse(error); }
}
