import { getSession, osuFetch } from '../../_shared/auth.js';
import { errorResponse, json } from '../../_shared/response.js';
import { readTransient, writeTransient } from '../../_shared/transient-cache.js';
import { fetchPpTableRow } from '../../_shared/pp-table.js';
import { parseCatchMods } from '../../../public/ctb-table.js';

export async function onRequestGet({request, env}) {
  try {
    const session = await getSession(request, env, {required:true});
    const params = new URL(request.url).searchParams;
    const id = params.get('id') || '';
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw Object.assign(Error('谱面 ID 无效。'), {status:400});
    let mods;
    try { mods = parseCatchMods(params.get('mods') || 'NM'); }
    catch (error) { throw Object.assign(error, {status:400}); }
    const cacheKey = `pp-table:v2:${Number(id)}:${mods.label}`;
    const cached = await readTransient(cacheKey);
    if (cached) return json(cached);
    const row = await fetchPpTableRow((path, options) => osuFetch(env, session, path, options), id, mods.label);
    await writeTransient(cacheKey, row, 3600);
    return json(row);
  } catch (error) { return errorResponse(error); }
}
