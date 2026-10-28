import { json, errorResponse, readJson } from '../_shared/response.js';
import { requireAdmin } from '../_shared/admin.js';
import { DEFAULT_CONTENT, validateContent, withDefaultLinks } from '../_shared/content.js';

export async function onRequestGet({ env }) {
  try { return json(withDefaultLinks(await env.SITE_CONTENT?.get('homepage', 'json') || DEFAULT_CONTENT)); }
  catch (error) { return errorResponse(error); }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env);
    if (!env.SITE_CONTENT) throw new Error('Content storage missing');
    const content = validateContent(await readJson(request));
    await env.SITE_CONTENT.put('homepage', JSON.stringify(content));
    return json(content);
  } catch (error) { return errorResponse(error); }
}

export async function imageResponse(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const object = await env.SITE_CONTENT?.getWithMetadata(`image:${id}`, 'arrayBuffer');
  if (!object?.value) return new Response('Not found', { status: 404 });
  return new Response(object.value, { headers: {
    'content-type': object.metadata?.type || 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff',
  }});
}
