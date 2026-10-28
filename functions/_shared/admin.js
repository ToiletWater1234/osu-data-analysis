import { getSession } from './auth.js';

export function isOwner(session, env) {
  const id = String(env.ADMIN_OSU_ID || '');
  return /^\d+$/.test(id) && String(session?.user?.id || '') === id;
}

export async function isAdmin(session, env) {
  if (isOwner(session, env)) return true;
  if (!session?.user?.id || !env.ADMIN_OSU_ID) return false;
  const admins = await env.SITE_CONTENT?.get('administrators', 'json') || [];
  return admins.some(user => String(user.id) === String(session.user.id));
}

export async function requireAdmin(request, env) {
  const info = await getSession(request, env, { required: true });
  if (!await isAdmin(info.session, env)) throw Object.assign(new Error('仅管理员可以修改首页。'), { status: 403 });
  return info;
}

export async function requireOwner(request, env) {
  const info = await getSession(request, env, { required: true });
  if (!isOwner(info.session, env)) throw Object.assign(new Error('只有 MyAngelHyacine 可以设置管理员。'), { status: 403 });
  return info;
}
