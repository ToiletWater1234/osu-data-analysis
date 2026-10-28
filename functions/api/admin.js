import { requireAdmin } from '../_shared/admin.js';
import { osuFetch } from '../_shared/auth.js';
import { json, errorResponse, readJson } from '../_shared/response.js';

export async function beatmap({ request, env }) {
  try {
    const session = await requireAdmin(request, env);
    const { query } = await readJson(request);
    const text = String(query || '').trim();
    let mapId, setId;
    if (/^\d+$/.test(text)) mapId = text;
    else {
      let url;
      try { url = new URL(text); } catch { throw Object.assign(new Error('请输入 osu! 谱面或谱包链接。'), { status: 400 }); }
      if (url.hostname !== 'osu.ppy.sh' || !['https:', 'http:'].includes(url.protocol)) throw Object.assign(new Error('只支持 osu.ppy.sh 链接。'), { status: 400 });
      setId = url.pathname.match(/^\/(?:beatmapsets|s)\/(\d+)/)?.[1];
      mapId = url.pathname.match(/^\/(?:beatmaps|b)\/(\d+)/)?.[1];
    }
    if (!setId && !mapId) throw Object.assign(new Error('没有识别到谱面 ID。'), { status: 400 });
    if (!setId) setId = (await osuFetch(env, session, `/beatmaps/${mapId}`)).beatmapset_id;
    const set = await osuFetch(env, session, `/beatmapsets/${setId}`);
    return json({ title: `${set.artist_unicode || set.artist} — ${set.title_unicode || set.title}`, source: 'beatmap', setId: set.id,
      linkUrl: /^\d+$/.test(text) || mapId ? `https://osu.ppy.sh/beatmaps/${mapId}` : text.startsWith('http') ? new URL(text).href : `https://osu.ppy.sh/beatmapsets/${set.id}`,
      imageUrl: `https://assets.ppy.sh/beatmaps/${set.id}/covers/cover@2x.jpg` });
  } catch (error) { return errorResponse(error); }
}

export async function upload({ request, env }) {
  try {
    await requireAdmin(request, env);
    if (!env.SITE_CONTENT) throw new Error('Content storage missing');
    if (Number(request.headers.get('content-length')) > 2 * 1024 * 1024) throw Object.assign(new Error('图片最大 2 MB。'), { status: 413 });
    const data = await request.arrayBuffer();
    if (!data.byteLength || data.byteLength > 2 * 1024 * 1024) throw Object.assign(new Error('图片需为 1 字节至 2 MB。'), { status: 413 });
    const b = new Uint8Array(data);
    const type = b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg'
      : b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10 ? 'image/png'
      : String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' ? 'image/webp' : '';
    if (!type) throw Object.assign(new Error('仅支持 JPG、PNG 和 WebP 图片。'), { status: 400 });
    const id = crypto.randomUUID();
    await env.SITE_CONTENT.put(`image:${id}`, data, { metadata: { type } });
    return json({ imageUrl: `/api/content/image/${id}`, source: 'upload' });
  } catch (error) { return errorResponse(error); }
}
