import { catchRowsHtml, catchRowsTsv, catchStarColors, escapeTableHtml as escapeHtml, formatDurationText, parseCatchMods, safeSpreadsheetCell, spreadsheetRowCell } from './ctb-table.js';

export const MANIA_TABLE_MODS = Object.freeze(['NM', 'DT', 'HT', 'HR', 'HD', 'EZ']);

export function maniaTargetSheet(stars) {
  if (stars >= 10) return '10+';
  if (stars < 5) return '';
  const lower = Math.floor(stars * 2) / 2;
  return `${lower}~${lower + 0.5}`;
}

// Preserve the original local mania table's seven columns, rounding and star-sheet rules.
export function buildManiaTableRow(beatmap, stars, modInput = 'NM') {
  const config = parseCatchMods(modInput);
  if (!MANIA_TABLE_MODS.includes(config.label)) throw Object.assign(Error('mania 表格沿用原版 NM / DT / HT / HR / HD / EZ 模组。'), {status:400});
  if (beatmap.mode !== 'mania') throw Object.assign(Error('此格式仅用于 osu!mania。'), {status:400});
  if (typeof stars !== 'number' || !Number.isFinite(stars) || stars < 0) throw Object.assign(Error('官方未返回有效星数。'), {status:502});
  const set = beatmap.beatmapset || {};
  const bpm = Number(beatmap.bpm ?? set.bpm) * config.clockRate;
  const baseLength = beatmap.total_length ?? beatmap.hit_length;
  if (!Number.isFinite(bpm) || bpm <= 0 || baseLength == null || !Number.isFinite(Number(baseLength)) || Number(baseLength) < 0) throw Object.assign(Error('谱面缺少有效 BPM 或时长。'), {status:502});
  const row = [String(beatmap.id), set.title || '', beatmap.version || '', `★${stars.toFixed(2)}`, formatDurationText(Number(baseLength) / config.clockRate), bpm.toFixed(2).replace(/\.00$/, ''), config.label === 'NM' ? '' : config.label];
  const setId = beatmap.beatmapset_id || set.id;
  return {beatmapId:beatmap.id, mode:'mania', mod:config.label, stars, colors:catchStarColors(stars), row, targetSheet:maniaTargetSheet(stars), sourceUrl:setId ? `https://osu.ppy.sh/beatmapsets/${setId}#mania/${beatmap.id}` : `https://osu.ppy.sh/beatmaps/${beatmap.id}`};
}

export function ppTableTsv(data) {
  return data.mode === 'fruits' ? catchRowsTsv([data]) : data.row.map(spreadsheetRowCell).join('\t');
}

export function ppTableHtml(data) {
  if (data.mode === 'fruits') return catchRowsHtml([data]);
  const base = "font-family:'Microsoft YaHei','微软雅黑',sans-serif;font-size:18pt;mso-font-charset:134;text-align:center;vertical-align:middle;";
  return `<table class="mania-export-table" style="border-collapse:collapse;${base}"><tbody><tr>${data.row.map((value, index) => {
    const style = `${base}padding:6px 8px;border:1px solid #D8DCE6;${index === 3 ? `background-color:${data.colors.background};` : ''}color:${index === 3 ? data.colors.text : '#111111'};font-weight:${index === 3 ? '600' : 'normal'};mso-number-format:'${index === 0 || index === 5 ? 'General' : '\\@'}';`;
    const text = escapeHtml(safeSpreadsheetCell(value));
    return `<td${index === 4 ? ` x:str="${escapeHtml(value)}" data-type="text"` : ''} style="${style}">${index === 0 ? `<a style="color:#1A73E8;text-decoration:underline;" href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noreferrer">${text}</a>` : text}</td>`;
  }).join('')}</tr></tbody></table>`;
}

export function ppClipboardHtml(fragment) {
  return `<!DOCTYPE html><html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
}
