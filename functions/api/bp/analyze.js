import { getSession, osuFetch } from "../../_shared/auth.js";
import { buildAnalysis, mapScore } from "../../_shared/profile.js";
import { rememberMapFacts } from '../../_shared/map-facts.js';
import {readTransient,writeTransient} from '../../_shared/transient-cache.js';
import { errorResponse, json, readJson } from "../../_shared/response.js";

const MODES = new Set(["osu", "taiko", "fruits", "mania"]);

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const userId = String(body.userId || "").trim();
    const mode = MODES.has(body.mode) ? body.mode : "mania";
    const keys = mode === "mania" && ["4k", "7k", "all"].includes(body.keys) ? body.keys : "all";
    if (!/^\d+$/.test(userId)) throw Object.assign(new Error("请选择有效的玩家。"), { status: 400 });
    const session = await getSession(request, env, { required: true });
    const extended = body.localLibrary === true;
    const cacheKey = `bp:v6:${userId}:${mode}:${keys}:${extended ? 'extras' : 'base'}`;
    const cached = await readTransient(cacheKey);
    if (cached) return json({ ...cached, cached: true });
    const [user, scores, pinned, recent] = await Promise.all([
      osuFetch(env, session, `/users/${userId}/${mode}?key=id`),
      osuFetch(env, session, `/users/${userId}/scores/best?mode=${mode}&limit=100`),
      osuFetch(env, session, `/users/${userId}/scores/pinned?mode=${mode}&limit=100`).catch(() => []),
      extended ? osuFetch(env,session,`/users/${userId}/scores/recent?mode=${mode}&limit=100&include_fails=0`).catch(()=>[]) : [],
    ]);
    if(String(user.id)!==String(Number(userId)))throw Object.assign(new Error('玩家身份查询结果不一致。'),{status:502});
    const analysis = buildAnalysis(user, scores, pinned, mode, keys);
    await rememberMapFacts(env,[...scores,...pinned,...recent].map(s=>s.beatmap));
    analysis.localExtrasEnabled=extended;
    analysis.supplementalScores = extended ? [...recent,...pinned].filter(s=>['loved','graveyard'].includes(s.beatmap?.status||s.beatmapset?.status)).map(mapScore) : [];
    analysis.analysisContext=cacheKey;
    await writeTransient(cacheKey,analysis,900);
    return json(analysis);
  } catch (error) {
    return errorResponse(error);
  }
}
