import { requireOwner } from '../_shared/admin.js';
import { osuFetch } from '../_shared/auth.js';
import { json, errorResponse, readJson } from '../_shared/response.js';

export async function list({ request, env }) {
  try { await requireOwner(request, env); return json({ users: await env.SITE_CONTENT.get('administrators', 'json') || [] }); }
  catch (error) { return errorResponse(error); }
}
export async function add({ request, env }) {
  try {
    const session = await requireOwner(request, env);
    const body = await readJson(request);
    const query = String(body.query || '').trim();
    if (!query || query.length > 80) throw Object.assign(new Error('请输入有效的 osu! 用户名或 ID。'), { status: 400 });
    const path = /^\d+$/.test(query) ? query : '@' + query;
    const user = await osuFetch(env, session, `/users/${encodeURIComponent(path)}`);
    if (!Number.isSafeInteger(user.id) || user.id < 1) throw new Error('Invalid user');
    const users = await env.SITE_CONTENT.get('administrators', 'json') || [];
    if (String(user.id) !== String(env.ADMIN_OSU_ID) && !users.some(item => item.id === user.id)) {
      if (users.length >= 20) throw Object.assign(new Error('最多设置 20 位管理员。'), { status: 400 });
      users.push({ id: user.id, username: user.username });
      await env.SITE_CONTENT.put('administrators', JSON.stringify(users));
    }
    return json({ users });
  } catch (error) { return errorResponse(error); }
}
export async function remove({ request, env }) {
  try {
    await requireOwner(request, env);
    const { id } = await readJson(request);
    if (!/^\d+$/.test(String(id))) throw Object.assign(new Error('用户 ID 无效。'), { status: 400 });
    if (String(id) === String(env.ADMIN_OSU_ID)) throw Object.assign(new Error('不能移除站长权限。'), { status: 400 });
    const users = (await env.SITE_CONTENT.get('administrators', 'json') || []).filter(user => String(user.id) !== String(id));
    await env.SITE_CONTENT.put('administrators', JSON.stringify(users));
    return json({ users });
  } catch (error) { return errorResponse(error); }
}
