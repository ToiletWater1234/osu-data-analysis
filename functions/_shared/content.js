export const DEFAULT_CONTENT = {
  title: '看清你的 BP，再决定下一张图。',
  intervalMs: 5000,
  slides: [
    { title: 'Laur — SEV-26', source: 'beatmap', setId: 2513401, imageUrl: 'https://assets.ppy.sh/beatmaps/2513401/covers/cover@2x.jpg' },
    { title: "Hexacube — Luminous Memory (Hexacube’s OVERSHINE Remix)", source: 'beatmap', setId: 2559951, imageUrl: 'https://assets.ppy.sh/beatmaps/2559951/covers/cover@2x.jpg' },
    { title: "beatMARIO — Saishuu Kichiku Imouto Flandre-S (Camellia’s Remix)", source: 'beatmap', setId: 2342737, imageUrl: 'https://assets.ppy.sh/beatmaps/2342737/covers/cover@2x.jpg' },
  ],
};

export function validateContent(body) {
  const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };
  const title = String(body.title || '').trim();
  if (!title || title.length > 100) bad('标题需为 1–100 个字符。');
  const intervalMs = Number(body.intervalMs);
  if (!Number.isInteger(intervalMs) || intervalMs < 3000 || intervalMs > 15000) bad('轮播间隔需为 3–15 秒。');
  if (!Array.isArray(body.slides) || body.slides.length < 1 || body.slides.length > 20) bad('请设置 1–20 张图片。');
  const slides = body.slides.map(slide => {
    const caption = String(slide.title || '').trim();
    if (caption.length > 150) bad('图片标题最多 150 个字符。');
    const imageUrl = String(slide.imageUrl || '');
    let linkUrl = String(slide.linkUrl ?? (slide.source === 'beatmap' ? `https://osu.ppy.sh/beatmapsets/${slide.setId}` : '')).trim();
    if (linkUrl) {
      let link;
      try { link = new URL(linkUrl); } catch { bad('图片超链接需要完整的 http:// 或 https:// 地址。'); }
      if (!['https:', 'http:'].includes(link.protocol) || link.username || link.password || linkUrl.length > 2048) bad('图片超链接只支持 http:// 或 https:// 地址。');
      linkUrl = link.href;
    }
    if (slide.source === 'upload' && /^\/api\/content\/image\/[a-f0-9-]{36}$/.test(imageUrl)) return { title: caption, imageUrl, linkUrl, source: 'upload' };
    if (slide.source === 'beatmap' && Number.isSafeInteger(Number(slide.setId)) && Number(slide.setId) > 0) {
      const expected = `https://assets.ppy.sh/beatmaps/${Number(slide.setId)}/covers/cover@2x.jpg`;
      if (imageUrl.split('?')[0] === expected) return { title: caption, imageUrl: expected, linkUrl, source: 'beatmap', setId: Number(slide.setId) };
    }
    bad('请先为每张轮播图片载入曲绘或上传图片。');
  });
  return { title, intervalMs, slides };
}

// Give existing saved beatmap slides their official link without rewriting admin content.
export function withDefaultLinks(content) {
  return { ...content, slides: content.slides.map(slide => ({ ...slide,
    linkUrl: slide.linkUrl ?? (slide.source === 'beatmap' && slide.setId ? `https://osu.ppy.sh/beatmapsets/${slide.setId}` : ''),
  })) };
}
