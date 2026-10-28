import { getSession, osuFetch } from "../../_shared/auth.js";
import { errorResponse, json } from "../../_shared/response.js";
import { getOsuSource } from '../../_shared/osu-files.js';
import { rememberMapFacts } from '../../_shared/map-facts.js';

function mapSet(set) {
  return {
    id: set.id,
    artist: set.artist_unicode || set.artist || "",
    title: set.title_unicode || set.title || "",
    creator: set.creator || "",
    cover: set.covers?.card || set.covers?.list || "",
    url: `https://osu.ppy.sh/beatmapsets/${set.id}`,
    beatmaps: (set.beatmaps || []).map((beatmap) => ({
      id: beatmap.id,
      status: beatmap.status || set.status || 'unknown',
      mode: beatmap.mode,
      version: beatmap.version,
      stars: Number(beatmap.difficulty_rating || 0),
      bpm: Number(beatmap.bpm || set.bpm || 0),
      length: Number(beatmap.total_length || 0),
      keys: beatmap.mode === "mania" ? Number(beatmap.cs || 0) : null,
      url: `https://osu.ppy.sh/beatmapsets/${set.id}#${beatmap.mode}/${beatmap.id}`,
    })),
  };
}

export async function onRequestGet({ request, env, ctx }) {
  try {
    const query = String(new URL(request.url).searchParams.get("q") || "").trim();
    if (!query) throw Object.assign(new Error("请输入歌名、谱面 ID 或 osu! 链接。"), { status: 400 });
    const session = await getSession(request, env, { required: true });
    const id = query.match(/(?:beatmaps\/|#\w+\/)(\d+)/i)?.[1] || (/^\d+$/.test(query) ? query : "");
    if (id) {
      const beatmap = await osuFetch(env, session, `/beatmaps/${id}`);
      const set = await osuFetch(env, session, `/beatmapsets/${beatmap.beatmapset_id}`);
      await rememberMapFacts(env,[beatmap]);
      if (ctx?.waitUntil && ['ranked','approved','qualified','loved'].includes(beatmap.status)) ctx.waitUntil(getOsuSource(env, id,{status:beatmap.status}).catch(() => {}));
      return json({ results: [mapSet(set)] });
    }
    const data = await osuFetch(env, session, `/beatmapsets/search?s=any&q=${encodeURIComponent(query)}`);
    return json({ results: (data.beatmapsets || []).slice(0, 10).map(mapSet) });
  } catch (error) {
    return errorResponse(error);
  }
}
