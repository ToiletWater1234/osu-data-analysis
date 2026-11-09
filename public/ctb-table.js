import { CTB_TABLE_STYLE as tableStyle } from './ctb-table-style.js';

// Shared by the local server and browser: table fields and Mod semantics agree.
export const CTB_HEADERS = ['ID', '名字', '难度', '星数(mod后)', '时长(mod后)', 'bpm(mod后)', '模组', '玩家评价'];
export const CTB_MOD_PRESETS = ['NM', 'HD', 'HR', 'HDHR', 'DT', 'HDDT', 'HRDT', 'HDHRDT', 'NC', 'HDNC', 'HT', 'HDHT', 'EZ', 'EZHD', 'EZDT', 'FL', 'HDFL'];
const MOD_ORDER = ['EZ', 'HD', 'HR', 'DT', 'NC', 'HT', 'FL'];
export const CTB_MOD_CHOICES = Object.freeze([
  { acronym:'EZ', name:'Easy · 简单' }, { acronym:'HD', name:'Hidden · 隐藏' },
  { acronym:'HR', name:'Hard Rock · 困难' }, { acronym:'DT', name:'Double Time · 加速' },
  { acronym:'NC', name:'Nightcore · 加速变调' }, { acronym:'HT', name:'Half Time · 减速' },
  { acronym:'FL', name:'Flashlight · 手电筒' },
]);
const MOD_CONFLICTS = Object.freeze({ EZ:['HR'], HR:['EZ'], DT:['NC','HT'], NC:['DT','HT'], HT:['DT','NC'] });

export function catchModConflicts(mod, selected) {
  return (MOD_CONFLICTS[mod] || []).filter(value => selected.includes(value));
}

export function parseCatchMods(input = 'NM') {
  const value = String(input).trim().toUpperCase().replace(/[+\s,]/g, '') || 'NM';
  if (value === 'NM') return { label: 'NM', mods: [], clockRate: 1 };
  const tokens = value.match(/.{1,2}/g) || [];
  if (tokens.some(mod => !MOD_ORDER.includes(mod)) || new Set(tokens).size !== tokens.length) {
    throw new Error('不支持的 CTB 模组。请选择 NM、HD、HR、DT、NC、HT、EZ、FL 或它们的有效组合。');
  }
  if (tokens.includes('EZ') && tokens.includes('HR')) throw new Error('EZ 与 HR 不能同时使用。');
  if (tokens.filter(mod => ['DT', 'NC', 'HT'].includes(mod)).length > 1) throw new Error('DT、NC 与 HT 不能同时使用。');
  const mods = MOD_ORDER.filter(mod => tokens.includes(mod));
  return { label: mods.join(''), mods, clockRate: mods.includes('HT') ? 0.75 : mods.some(mod => ['DT', 'NC'].includes(mod)) ? 1.5 : 1 };
}

export const escapeTableHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const cleanCell = value => String(value ?? '').replace(/[\t\r\n\u0000-\u001f]/g, ' ');
export const floorStars = value => Math.floor(Number(value) * 100) / 100;
function numericCatchId(value) {
  const text = String(value ?? '').trim();
  const id = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(id) || id <= 0) throw new Error('CTB 谱面 ID 必须是有效的正整数。');
  return id;
}
export function formatDurationText(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0 || seconds == null) throw new Error('谱面时长无效。');
  const rounded = Math.round(Number(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
// Spreadsheet applications treat a leading =/+/-/@ as a formula, even in TSV.
export function safeSpreadsheetCell(value) {
  const text = cleanCell(value);
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

export function spreadsheetRowCell(value, column) {
  // TSV has no cell type: use the spreadsheet text prefix to stop m:ss -> h:mm.
  if (column === 4 && /^\d+:[0-5]\d$/.test(String(value))) return "'" + value;
  return safeSpreadsheetCell(value);
}

export function catchStarColors(stars) {
  const stops = [[0.1,'#4290FB'],[1.25,'#4FC0FF'],[2,'#4FFFD5'],[2.5,'#7CFF4F'],[3.3,'#F6F05C'],[4.2,'#FF8068'],[4.9,'#FF4E6F'],[5.8,'#C645B8'],[6.7,'#6563DE'],[7.7,'#18158E'],[9,'#000000']];
  let background = stars < 0.1 ? '#AAAAAA' : '#000000';
  for (let i = 1; stars >= 0.1 && stars < 9 && i < stops.length; i++) {
    if (stars > stops[i][0]) continue;
    const [low, left] = stops[i - 1], [high, right] = stops[i];
    const t = Math.max(0, (stars - low) / (high - low));
    const rgb = [1,3,5].map(offset => Math.round(parseInt(left.slice(offset,offset+2),16)*(1-t)+parseInt(right.slice(offset,offset+2),16)*t).toString(16).padStart(2,'0'));
    background = '#' + rgb.join('').toUpperCase();
    break;
  }
  const textStops = [[9,'#F6F05C'],[9.9,'#FF8068'],[10.6,'#FF4E6F'],[11.5,'#C645B8'],[12.4,'#6563DE']];
  let text = stars < 6.5 ? '#000000' : '#F6F05C';
  if (stars >= 12.4) text = textStops.at(-1)[1];
  else if (stars >= 9) {
    for (let i=1;i<textStops.length;i++) {
      if (stars > textStops[i][0]) continue;
      const [low,left]=textStops[i-1], [high,right]=textStops[i], t=(stars-low)/(high-low);
      text='#'+[1,3,5].map(offset=>Math.round(parseInt(left.slice(offset,offset+2),16)*(1-t)+parseInt(right.slice(offset,offset+2),16)*t).toString(16).padStart(2,'0')).join('').toUpperCase();
      break;
    }
  }
  return { background, text };
}

export function buildCatchRow(beatmap, attributes, modInput = 'NM') {
  if (beatmap.mode !== 'fruits' && beatmap.mode !== 'osu') throw new Error('仅支持原生 osu!catch 谱面或可转换的 osu!standard 谱面。');
  const config = parseCatchMods(modInput);
  const stars = attributes?.star_rating;
  if (typeof stars !== 'number' || !Number.isFinite(stars) || stars < 0) throw new Error('osu! 未返回有效的 CTB Mod 后星数，请重试。');
  const set = beatmap.beatmapset || {};
  const baseBpm = beatmap.bpm ?? set.bpm;
  const baseLength = beatmap.total_length ?? beatmap.hit_length;
  if (!Number.isFinite(Number(baseBpm)) || Number(baseBpm) <= 0 || !Number.isFinite(Number(baseLength)) || Number(baseLength) < 0 || baseLength == null) throw new Error('谱面缺少有效的 BPM 或时长。');
  const bpm = Number(baseBpm) * config.clockRate;
  const length = Number(baseLength) / config.clockRate;
  const duration = formatDurationText(length);
  const row = [numericCatchId(beatmap.id), cleanCell(set.title || set.title_unicode || ''), cleanCell(beatmap.version), `★${floorStars(stars).toFixed(2)}`, duration, bpm.toFixed(2), config.label === 'NM' ? '' : config.label, ''];
  const sourceUrl = `https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id || set.id}#fruits/${beatmap.id}`;
  return { beatmapId: beatmap.id, mode: 'fruits', converted: beatmap.mode === 'osu', mod: config.label, mods: config.mods, stars, bpm, length, clockRate: config.clockRate, sourceUrl, colors: catchStarColors(stars), headers: CTB_HEADERS, row, tsv: row.map(spreadsheetRowCell).join('\t') };
}

export function catchRowCells(item) {
  // Old seven-column cached rows can still be copied without shifting the review column.
  return CTB_HEADERS.map((_, index) => index === 0 ? numericCatchId(item.row[index]) : cleanCell(item.row[index] ?? ''));
}

export function catchRowsTsv(rows, includeHeader = false) {
  return [...(includeHeader ? [CTB_HEADERS.join('\t')] : []), ...rows.map(item => catchRowCells(item).map(spreadsheetRowCell).join('\t'))].join('\r\n');
}

export function catchRowsHtml(rows, includeHeader = false, options = {}) {
  const font = `font-family:${tableStyle.fontFamily};font-size:${tableStyle.fontSize};mso-font-charset:134;`;
  const base = `${font}padding:8px 12px;text-align:center;vertical-align:middle;line-height:1.5;`;
  const borders = index => `border-top:1px solid ${tableStyle.border};border-bottom:1px solid ${tableStyle.border};border-left:${index === 0 ? `1px solid ${tableStyle.border}` : 'none'};border-right:${index === 7 ? `1px solid ${tableStyle.border}` : 'none'};`;
  const headerColor = options.header === 'overdose' ? tableStyle.overdoseHeader : tableStyle.rainHeader;
  const head = includeHeader ? `<thead><tr>${CTB_HEADERS.map((value, index) => `<th bgcolor="${headerColor}" style="${base}${borders(index)}background-color:${headerColor};color:#FFFFFF;font-weight:bold;white-space:nowrap;">${escapeTableHtml(value)}</th>`).join('')}</tr></thead>` : '';
  const body = rows.map(item => {
    const colors = catchStarColors(item.stars);
    return `<tr>${catchRowCells(item).map((value, index) => {
      // Body cells deliberately have no fill, so inserting/sorting rows needs no band maintenance.
      const fill = index === 3 ? colors.background : '';
      const color = index === 0 ? tableStyle.link : index === 3 ? colors.text : tableStyle.text;
      const format = index === 0 ? '0' : index === 5 ? '0.00' : '\\@';
      const style = `${base}${borders(index)}${fill ? `background-color:${fill};` : ''}color:${color};font-weight:${index === 3 ? 'bold' : 'normal'};white-space:${[1, 2, 7].includes(index) ? 'normal' : 'nowrap'};mso-number-format:'${format}';`;
      const text = escapeTableHtml(safeSpreadsheetCell(value));
      const content = index === 0 ? `<a href="${escapeTableHtml(item.sourceUrl)}" target="_blank" rel="noreferrer" style="${font}color:${tableStyle.link};text-decoration:underline;">${text}</a>` : text;
      const type = index === 0 ? ` x:num="${value}" data-type="number"` : index === 4 || index === 7 ? ` x:str="${escapeTableHtml(value)}" data-type="text"` : '';
      return `<td${type}${fill ? ` bgcolor="${fill}"` : ''} style="${style}">${content}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<table class="ctb-export-table" style="border-collapse:collapse;${font}">${head}<tbody>${body}</tbody></table>`;
}

export function addCatchRow(rows, item) {
  const key = row => `${row.beatmapId}:${row.mod}`;
  const index = rows.findIndex(row => key(row) === key(item));
  item.row = catchRowCells(item);
  if (index < 0) rows.push(item);
  else {
    // Refreshing official attributes must not erase a staff member's handwritten review.
    item.row[7] ||= rows[index].row[7] || '';
    rows[index] = item;
  }
  item.tsv = catchRowsTsv([item]);
  return rows;
}
