export async function getOsuSource(env, id, { status } = {}) {
  if (!/^\d{1,12}$/.test(String(id))) throw Object.assign(new Error('谱面 ID 无效。'), { status: 400 });
  if (!['ranked','approved','qualified','loved'].includes(status)) {
    // Missing keys still count as deletes. Only remove an actual legacy entry.
    await Promise.all([[env.OSU_FILES,`osu-file:v1:${id}`],[env.CACHE,`osu-source:v1:${id}`]].map(async([store,key])=>{try{if(store?.get&&await store.get(key))await store.delete(key);}catch{}}));
    throw Object.assign(new Error('坟图或未确认状态的谱面仅使用本地 .osu，请先绑定 osu! 文件夹。'),{status:412});
  }
  const store = env.OSU_FILES || env.CACHE;
  const key = `osu-file:v1:${id}`;
  const cached = store ? await store.get(key).catch(() => null) : null;
  if (cached) return { source: cached, cached: true, stored: true };
  let source = env.CACHE ? await env.CACHE.get(`osu-source:v1:${id}`).catch(() => null) : null;
  const legacyCached = Boolean(source);
  if (!source) {
    const response = await fetch(`https://osu.ppy.sh/osu/${id}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Object.assign(new Error(`谱面下载失败（${response.status}）。`), { status: 422 });
    if (Number(response.headers.get('content-length')) > 2_000_000) throw Object.assign(new Error('谱面超过在线分析大小限制。'), { status: 422 });
    source = await response.text();
  }
  if (source.length > 2_000_000) throw Object.assign(new Error('谱面超过在线分析大小限制。'), { status: 422 });
  if (!/^osu file format v\d+/m.test(source)) throw Object.assign(new Error('下载内容不是有效的 osu! 谱面。'), { status: 422 });
  let stored = false;
  if (store) {
    try {
      // No expiration: reuse the complete source for all rates and mods.
      await store.put(key, source, { metadata: { savedAt: Date.now(), characters: source.length } });
      stored = true;
    } catch { console.warn('osu-file persistence unavailable; returning downloaded source'); }
  }
  return { source, cached: legacyCached, stored };
}
