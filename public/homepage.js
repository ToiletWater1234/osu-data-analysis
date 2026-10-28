const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let content, draft, active = 0, timer, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let hover = false, focus = false, busy = false;
const stage = $('#carousel-stage'), dialog = $('#home-editor'), status = $('#editor-status');

async function request(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}
const post = (path, body) => request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
function schedule() {
  clearInterval(timer);
  if (content?.slides.length > 1 && !paused && !hover && !focus && !document.hidden) timer = setInterval(() => show(active + 1), content.intervalMs);
}
function show(index) {
  if (!content?.slides.length) return;
  active = (index + content.slides.length) % content.slides.length;
  [...stage.children].forEach((slide, i) => { slide.classList.toggle('active', i === active); slide.setAttribute('aria-hidden', String(i !== active)); const link = slide.querySelector('a'); if (link) link.tabIndex = i === active ? 0 : -1; });
  [...$('#carousel-dots').children].forEach((dot, i) => { dot.classList.toggle('active', i === active); dot.setAttribute('aria-current', String(i === active)); });
}
function render() {
  $('#hero-title').textContent = content.title;
  stage.innerHTML = content.slides.map((slide, i) => {
    const image = `<img src="${escape(slide.imageUrl)}" alt="${escape(slide.title || '轮播图片')}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} />${slide.title ? `<figcaption><h2>${escape(slide.title)}</h2></figcaption>` : ''}`;
    const link = /^https?:\/\//i.test(slide.linkUrl || '') ? `<a class="carousel-image-link" href="${escape(slide.linkUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(slide.title || '打开图片链接')}">${image}</a>` : image;
    return `<figure class="carousel-slide" role="group" aria-roledescription="幻灯片" aria-label="${i + 1} / ${content.slides.length}">${link}</figure>`;
  }).join('');
  $('#carousel-dots').innerHTML = content.slides.map((_, i) => `<button type="button" aria-label="切换到第 ${i + 1} 张图片" data-slide="${i}"></button>`).join('');
  $('#carousel-controls').hidden = content.slides.length < 2;
  $('#carousel-prev').hidden = $('#carousel-next').hidden = content.slides.length < 2;
  show(0); schedule();
}
$('#carousel-prev').addEventListener('click', () => { show(active - 1); schedule(); });
$('#carousel-next').addEventListener('click', () => { show(active + 1); schedule(); });
$('#carousel-dots').addEventListener('click', event => { const button = event.target.closest('[data-slide]'); if (button) { show(Number(button.dataset.slide)); schedule(); } });
stage.addEventListener('mouseenter', () => { hover = true; schedule(); });
stage.addEventListener('mouseleave', () => { hover = false; schedule(); });
document.querySelector('.home-carousel').addEventListener('focusin', () => { focus = true; schedule(); });
document.querySelector('.home-carousel').addEventListener('focusout', event => { if (!event.currentTarget.contains(event.relatedTarget)) { focus = false; schedule(); } });
document.addEventListener('visibilitychange', schedule);
const ready = request('/api/content').then(data => { content = data; render(); }).catch(error => { stage.innerHTML = '<p class="carousel-loading">精选图片暂时无法载入，请刷新重试。</p>'; throw error; });
ready.catch(() => {});

let owner = false;
export function setHomepageAdmin(enabled, isOwner = false) { owner = isOwner; $('#edit-home').hidden = !enabled; $('#admin-users-section').hidden = !owner; if (!enabled && dialog.open) dialog.close(); }
function renderEditor() {
  $('#slide-count').textContent = `${draft.slides.length} / 20`;
  $('#add-slide').disabled = draft.slides.length >= 20;
  $('#slide-editor-list').innerHTML = draft.slides.map((slide, i) => `<article class="slide-editor" data-index="${i}"><div class="slide-preview">${slide.imageUrl ? `<img src="${escape(slide.imageUrl)}" alt="轮播预览 ${i + 1}" />` : '<span>等待选择图片</span>'}</div><div class="slide-fields"><div class="slide-row-heading"><strong>图片 ${i + 1}</strong><div><button type="button" data-action="up" aria-label="上移图片 ${i + 1}" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-action="down" aria-label="下移图片 ${i + 1}" ${i === draft.slides.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-action="remove" ${draft.slides.length === 1 ? 'disabled' : ''}>移除</button></div></div><label>图片标题<input data-field="title" maxlength="150" value="${escape(slide.title)}" /></label><label>点击图片跳转的链接（可留空）<input data-field="linkUrl" type="url" maxlength="2048" value="${escape(slide.linkUrl || '')}" placeholder="https://…" /></label><div class="source-input"><label>osu! 谱面或谱包链接<input data-field="query" placeholder="https://osu.ppy.sh/beatmapsets/… 或谱面 ID" /></label><button type="button" data-action="beatmap" class="secondary-button">载入曲绘</button></div><label class="upload-label">或上传自己的图片<input type="file" data-field="upload" accept="image/jpeg,image/png,image/webp" /></label></div></article>`).join('');
}
$('#edit-home').addEventListener('click', async () => {
  try { await ready; draft = structuredClone(content); $('#home-title-input').value = draft.title; $('#home-interval').value = draft.intervalMs / 1000; status.textContent = ''; renderEditor(); dialog.showModal(); if (owner) loadAdmins(); }
  catch (error) { alert(error.message); }
});
let adminBusy = false;
function renderAdmins(users) {
  $('#admin-user-list').innerHTML = users.length ? users.map(user => `<div class="admin-user"><span>${escape(user.username)} <small>· ${user.id}</small></span><button type="button" data-remove-admin="${user.id}" class="secondary-button">移除管理员</button></div>`).join('') : '<p class="editor-hint">暂未添加其他管理员。</p>';
}
async function loadAdmins() {
  try { const data = await request('/api/admin/users'); renderAdmins(data.users); }
  catch (error) { $('#admin-user-status').textContent = error.message; }
}
$('#add-admin').addEventListener('click', async () => {
  if (!owner || adminBusy) return;
  const query = $('#new-admin-query').value.trim();
  if (!query) { $('#admin-user-status').textContent = '请输入要授权的 osu! 用户名或 ID。'; return; }
  adminBusy = true; $('#add-admin').disabled = true; $('#admin-user-status').textContent = '正在核实玩家…';
  try { const data = await post('/api/admin/users', { query }); renderAdmins(data.users); $('#new-admin-query').value = ''; $('#admin-user-status').textContent = '权限已保存，对方刷新网站后生效。'; }
  catch (error) { $('#admin-user-status').textContent = error.message; }
  finally { adminBusy = false; $('#add-admin').disabled = false; }
});
$('#admin-user-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-remove-admin]'); if (!button || !owner || adminBusy) return;
  adminBusy = true;
  try { const data = await post('/api/admin/users/remove', { id: button.dataset.removeAdmin }); renderAdmins(data.users); $('#admin-user-status').textContent = '管理员权限已移除。'; }
  catch (error) { $('#admin-user-status').textContent = error.message; }
  finally { adminBusy = false; }
});
$('#close-editor').addEventListener('click', () => { if (!busy) dialog.close(); });
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('#add-slide').addEventListener('click', () => { if (!busy && draft.slides.length < 20) { draft.slides.push({ title: '', imageUrl: '', source: '' }); renderEditor(); } });
$('#slide-editor-list').addEventListener('input', event => {
  if (['title', 'linkUrl'].includes(event.target.dataset.field)) draft.slides[Number(event.target.closest('[data-index]').dataset.index)][event.target.dataset.field] = event.target.value;
});
async function runEdit(task) {
  if (busy) return;
  busy = true; status.textContent = '正在处理…';
  $('#save-home').disabled = true;
  try { await task(); status.textContent = '图片已就绪，点击“保存并应用”发布。'; renderEditor(); }
  catch (error) { status.textContent = error.message; }
  finally { busy = false; $('#save-home').disabled = false; }
}
$('#slide-editor-list').addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button || busy) return;
  const row = button.closest('[data-index]'), i = Number(row.dataset.index), action = button.dataset.action;
  if (action === 'remove') { if (draft.slides.length > 1) draft.slides.splice(i, 1); renderEditor(); }
  if (action === 'up' || action === 'down') { const other = i + (action === 'up' ? -1 : 1); if (draft.slides[other]) [draft.slides[i], draft.slides[other]] = [draft.slides[other], draft.slides[i]]; renderEditor(); }
  if (action === 'beatmap') { const query = row.querySelector('[data-field=query]').value; runEdit(async () => { draft.slides[i] = await post('/api/admin/beatmap', { query }); }); }
});
$('#slide-editor-list').addEventListener('change', event => {
  if (event.target.dataset.field !== 'upload' || busy) return;
  const file = event.target.files?.[0]; if (!file) return;
  const i = Number(event.target.closest('[data-index]').dataset.index);
  runEdit(async () => {
    if (file.size > 2 * 1024 * 1024) throw new Error('图片最大 2 MB，请压缩后重试。');
    const slide = await request('/api/admin/image', { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
    draft.slides[i] = { ...slide, title: draft.slides[i].title || file.name.replace(/\.[^.]+$/, ''), linkUrl: draft.slides[i].source === 'upload' ? draft.slides[i].linkUrl || '' : '' };
  });
});
$('#home-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  if (draft.slides.some(s => !s.imageUrl)) { status.textContent = '请先为每张图片载入曲绘或上传图片。'; return; }
  busy = true; $('#save-home').disabled = true; status.textContent = '正在保存…';
  try { content = await post('/api/admin/content', { title: $('#home-title-input').value, intervalMs: Number($('#home-interval').value) * 1000, slides: draft.slides }); render(); dialog.close(); }
  catch (error) { status.textContent = error.message; }
  finally { busy = false; $('#save-home').disabled = false; }
});
