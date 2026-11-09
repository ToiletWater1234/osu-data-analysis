import { escapeTableHtml as escapeHtml } from './ctb-table.js';
import { catchModPickerHtml, readCatchModPicker, updateCatchModPicker } from './ctb-mod-picker.js';
import { MANIA_TABLE_MODS, ppTableHtml, ppTableTsv, ppClipboardHtml } from './pp-table.js';

export function renderPpMapTools(beatmap) {
  const supported = ['mania','fruits'].includes(beatmap.mode);
  const mode = beatmap.mode === 'fruits' ? 'CTB' : beatmap.mode || 'osu';
  return `<div class="pp-map-row" data-map-id="${escapeHtml(beatmap.id)}" data-map-mode="${escapeHtml(beatmap.mode)}">
    <a href="${escapeHtml(beatmap.url)}" target="_blank" rel="noreferrer">${escapeHtml(beatmap.version)} · ${escapeHtml(mode)} · ${Number(beatmap.stars).toFixed(2)}★${beatmap.keys ? ` · ${beatmap.keys}K` : ''}</a>
    ${supported ? `<details class="pp-map-generator"><summary>生成${beatmap.mode === 'fruits' ? ' CTB 八列' : ' mania 原版七列'}表格格式</summary>
      ${beatmap.mode === 'fruits' ? catchModPickerHtml() : `<label>模组<select class="mania-table-mod">${MANIA_TABLE_MODS.map(mod => `<option value="${mod}">${mod}</option>`).join('')}</select></label>`}
      <button type="button" class="secondary-button" data-pp-generate>生成表格行</button>
      <p class="pp-row-status" role="status"></p><div class="pp-row-output" hidden></div>
    </details>` : ''}</div>`;
}

function modConfig(row) {
  const picker = row.querySelector('.ctb-mod-picker');
  return picker ? readCatchModPicker(picker).label : row.querySelector('.mania-table-mod').value;
}

function preview(data) {
  if (data.mode !== 'fruits') return `<p class="progress-status">mania 原版七列 · ${escapeHtml(data.mod)} · 目标分页：${escapeHtml(data.targetSheet || '未落入 5★ 以上分页')}</p><div class="pp-copy-preview">${copyPreview(data)}</div>`;
  return `<p class="progress-status">CTB 八列 · ${escapeHtml(data.mod)} · 星数、BPM、时长均为 Mod 后值；时长按文本“分:秒”复制。</p>
    <div class="pp-review-editor"><label>玩家评价<input class="pp-review" type="text" placeholder="可选，留空不填评价" value="${escapeHtml(data.row[7] || '')}" /></label></div>
    <p class="progress-status">正文无填充色，保留星数难度色。空白评价格仍复制。</p>
    <div class="pp-copy-preview">${copyPreview(data)}</div>`;
}

function copyPreview(data) {
  return `<button type="button" class="secondary-button" data-pp-copy>复制表格格式</button><div class="pp-table-preview">${ppTableHtml(data)}</div>`;
}

export function setupPpTableTools({root, api, requireLogin, showNotice}) {
  if (!root) return;
  const rows = new WeakMap();
  const drafts = new Map();
  root.addEventListener('change', event => {
    const row = event.target.closest('.pp-map-row');
    if (!row) return;
    const picker = event.target.closest('.ctb-mod-picker');
    if (picker) updateCatchModPicker(picker);
    if (picker || event.target.matches('.mania-table-mod')) {
      row.querySelector('.pp-row-output').hidden = true;
      row.querySelector('.pp-row-status').textContent = '模组已修改，请重新生成表格行。';
    }
  });
  root.addEventListener('input', event => {
    if (!event.target.matches('.pp-review')) return;
    const row = event.target.closest('.pp-map-row');
    const data = rows.get(row);
    if (!data) return;
    data.row[7] = row.querySelector('.pp-review').value;
    drafts.set(`${data.beatmapId}:${data.mod}`, {review:data.row[7]});
    row.querySelector('.pp-copy-preview').innerHTML = copyPreview(data);
  });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-pp-generate], [data-pp-copy]');
    if (!button) return;
    const row = button.closest('.pp-map-row');
    const output = row.querySelector('.pp-row-output');
    const status = row.querySelector('.pp-row-status');
    if (button.hasAttribute('data-pp-generate')) {
      if (!requireLogin()) return;
      const mods = modConfig(row);
      button.disabled = true;
      status.textContent = '正在获取官方 Mod 后难度…';
      try {
        const data = await api(`/api/beatmaps/table-row?id=${encodeURIComponent(row.dataset.mapId)}&mods=${encodeURIComponent(mods)}`);
        // A changed selection or a new search must not reveal a stale result.
        if (!row.isConnected || modConfig(row) !== mods) return;
        const draft = drafts.get(`${data.beatmapId}:${data.mod}`);
        if (data.mode === 'fruits' && draft) data.row[7] = draft.review;
        rows.set(row, data);
        output.innerHTML = preview(data);
        output.hidden = false;
        status.textContent = '已生成。请选择复制按钮，再粘贴到目标表格第一列。';
      } catch (error) {
        output.hidden = true;
        status.textContent = error.message;
        showNotice(error.message, true);
      } finally { button.disabled = false; }
      return;
    }
    const data = rows.get(row);
    if (!data || output.hidden) return;
    const text = ppTableTsv(data);
    button.disabled = true;
    try {
      let rich = false;
      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({
            'text/html':new Blob([ppClipboardHtml(ppTableHtml(data))],{type:'text/html'}),
            'text/plain':new Blob([text],{type:'text/plain'}),
          })]);
          rich = true;
        } catch { /* Fall back without claiming that plain text keeps the styling. */ }
      }
      if (!rich) await navigator.clipboard.writeText(text);
      status.textContent = rich ? '已复制正文无填充色的格式行，保留字体、边框和星数颜色。请在目标表格选中第一列粘贴。' : '已复制纯文本行；纯文本不含字体、边框或星数颜色。';
    } catch {
      const existing = row.querySelector('.pp-copy-fallback');
      existing?.remove();
      const fallback = document.createElement('textarea');
      fallback.className = 'pp-copy-fallback';
      fallback.setAttribute('aria-label','手动复制表格文本');
      fallback.readOnly = true; fallback.value = text;
      output.append(fallback); fallback.focus(); fallback.select();
      status.textContent = '剪贴板访问被拒绝。已选中纯文本，请按 Ctrl+C；不含颜色和字体。';
    } finally { button.disabled = false; }
  });
}
