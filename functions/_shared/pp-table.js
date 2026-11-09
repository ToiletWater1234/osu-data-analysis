import { buildCatchRow, parseCatchMods } from '../../public/ctb-table.js';
import { buildManiaTableRow, MANIA_TABLE_MODS } from '../../public/pp-table.js';

export async function fetchPpTableRow(osuFetch, id, modInput = 'NM') {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw Object.assign(Error('谱面 ID 无效。'), {status:400});
  let config;
  try { config = parseCatchMods(modInput); }
  catch (error) { throw Object.assign(error, {status:400}); }
  const beatmap = await osuFetch(`/beatmaps/${Number(id)}`);
  if (!['mania', 'fruits'].includes(beatmap.mode)) throw Object.assign(Error('表格格式生成仅支持 osu!mania 和 osu!catch 原生谱面。'), {status:400});
  if (beatmap.mode === 'mania' && !MANIA_TABLE_MODS.includes(config.label)) throw Object.assign(Error('mania 沿用原版单模组格式；组合模组用于 CTB。'), {status:400});
  let stars = beatmap.difficulty_rating;
  if (beatmap.mode === 'fruits' || config.label !== 'NM') {
    const response = await osuFetch(`/beatmaps/${Number(id)}/attributes`, {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ruleset:beatmap.mode, mods:config.mods}),
    });
    stars = response?.attributes?.star_rating;
  }
  if (typeof stars !== 'number' || !Number.isFinite(stars) || stars < 0) throw Object.assign(Error('官方未返回有效的 Mod 后星数。'), {status:502});
  if (beatmap.mode === 'mania') return buildManiaTableRow(beatmap, stars, config.label);
  try { return buildCatchRow(beatmap, {star_rating:stars}, config.label); }
  catch (error) { throw Object.assign(error, {status:502}); }
}
