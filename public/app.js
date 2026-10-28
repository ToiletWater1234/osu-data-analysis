import { buildManiaProfile } from './mania-profile.js';
import { analyzeChart } from './chart-client.js';
import {localReady,isLocalBound,searchLocal,readLocalEntry,findLocalSource} from './local-library.js';
import {collectAnalysisSamples} from './analysis-samples.js';
import './local-library-ui.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = { authenticated: false, user: null };
const notice = $("#notice");
const homepage = $('#carousel-stage') ? import('./homepage.js') : Promise.resolve(null);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.classList.toggle("error", error);
  notice.hidden = !message;
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showNotice("登录状态已失效，请重新使用 osu! 登录。", true);
    throw new Error(data.error || `请求失败（${response.status}）`);
  }
  return data;
}

function requireLogin() {
  if (state.authenticated) return true;
  showNotice("请先点击右上角“使用 osu! 登录”。", true);
  return false;
}

function formatPercent(value) { return `${(Number(value || 0) * 100).toFixed(2)}%`; }
function formatPp(value) { return `${Number(value || 0).toFixed(2)}pp`; }
function formatLength(value) { const seconds = Math.round(Number(value || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

async function loadSession() {
  try {
    const data = await api("/api/auth/session");
    state.authenticated = data.authenticated;
    state.user = data.user;
    (await homepage)?.setHomepageAdmin(Boolean(data.isAdmin), Boolean(data.isOwner));
    const area = $("#auth-area");
    if (!data.configured) showNotice("osu! 授权登录等待管理员配置，配置完成后即可使用在线查询与分析。", false);
    if (data.authenticated) {
      if ($('#player-query')) {
        $('#player-query').placeholder = `例如 ${data.user.username} 或 ${data.user.id}`;
        $('#player-query').value = data.user.username;
      }
      if ($('#compare-a')) $('#compare-a').value = data.user.id;
      area.innerHTML = `<div class="user-chip"><img src="${escapeHtml(data.user.avatarUrl)}" alt="" /><span><b>${escapeHtml(data.user.username)}</b><small>已通过 osu! 登录</small></span><button id="logout-button" class="logout-button">退出</button></div>`;
      $("#logout-button").addEventListener("click", async () => {
        await api("/api/auth/logout", { method: "POST" });
        location.href = location.pathname;
      });
    }
  } catch (error) {
    showNotice(error.message, true);
  }
  const params = new URLSearchParams(location.search);
  if (params.get("login") === "success") showNotice("osu! 授权登录成功。", false);
  if (params.get("login") === "cancelled") showNotice("已取消 osu! 授权。", true);
  if (params.get("login") === "error") showNotice(params.get("message") || "授权失败。", true);
  if (params.has("login")) history.replaceState(null, "", location.pathname);
}

function setModeFields(mode, field) {
  field.hidden = mode !== "mania";
}

$("#mode-select")?.addEventListener("change", (event) => setModeFields(event.target.value, $("#keys-field")));
$("#compare-mode")?.addEventListener("change", (event) => setModeFields(event.target.value, $("#compare-keys-field")));

function playerResult(user) {
  return `<button class="player-result" data-user-id="${user.id}"><img src="${escapeHtml(user.avatarUrl)}" alt="" /><strong>${escapeHtml(user.username)}<span>${escapeHtml(user.countryCode)} · ID ${user.id}</span></strong></button>`;
}

$("#player-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const query = $("#player-query").value.trim();
  const output = $("#player-results");
  output.innerHTML = `<div class="empty">正在搜索…</div>`;
  try {
    const data = await api(`/api/users/search?q=${encodeURIComponent(query)}`);
    output.innerHTML = data.results.length ? data.results.map(playerResult).join("") : `<div class="empty">没有找到玩家。</div>`;
    $$(".player-result", output).forEach((button) => button.addEventListener("click", () => analyzePlayer(button.dataset.userId)));
  } catch (error) {
    output.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
});

function progressCard() {
  return `<div class="analysis-card progress-card" id="progress-card"><div class="progress-top"><strong>正在生成 BP 画像</strong><b id="progress-percent">4%</b></div><div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div><span id="progress-status" class="progress-status">正在连接 osu! API…</span></div>`;
}

async function withProgress(container, task) {
  container.innerHTML = progressCard();
  const fill = $("#progress-fill", container);
  const percent = $("#progress-percent", container);
  const status = $("#progress-status", container);
  let value = 4;
  const stages = ["正在读取玩家资料…", "正在获取 BP 与置顶成绩…", "正在计算准度、Miss 与客户端分布…", "正在整理能力画像…"];
  let stage = 0;
  const timer = setInterval(() => {
    value = Math.min(88, value + Math.max(1, Math.round((90 - value) * .12)));
    fill.style.width = `${value}%`;
    percent.textContent = `${value}%`;
    stage = Math.min(stages.length - 1, Math.floor(value / 23));
    status.textContent = stages[stage];
  }, 320);
  requestAnimationFrame(() => { fill.style.width = "4%"; });
  try {
    const result = await task();
    clearInterval(timer);
    if (result.mode === 'mania') await enrichMania(result, (done, total, message) => {
      const progress = 30 + Math.round(done / Math.max(1, total) * 65);
      fill.style.width = `${progress}%`;
      percent.textContent = `${progress}%`;
      status.textContent = message || `LeoBlack 谱面分析 ${done} / ${total}…`;
    });
    fill.style.width = "100%";
    percent.textContent = "100%";
    status.textContent = "分析完成";
    await new Promise((resolve) => setTimeout(resolve, 180));
    return result;
  } finally {
    clearInterval(timer);
  }
}

async function enrichMania(data, progress = () => {}) {
  const analyses = [];
  const failures = [];
  const sample = await collectAnalysisSamples(data,api,message=>progress(0,1,message));
  const scores = sample.scores;
  data.extraScores = scores.filter(score=>score.localSupplement);
  let completed = 0;
  // Each chart has its own Worker request and calculation budget.
  for (const score of scores) {
    const speedMod = (score.modDetails || []).find(m => typeof m !== 'string' && ['DT', 'NC', 'HT', 'DC'].includes(m.acronym));
    const rate = Number(speedMod?.settings?.speed_change || (score.mods.some(m => ['DT', 'NC'].includes(m)) ? 1.5 : score.mods.some(m => ['HT', 'DC'].includes(m)) ? 0.75 : 1));
    const cvtFlag = ['HO', 'IN'].filter(m => score.mods.includes(m)).join('') || null;
    try {
      if (score.mods.some(m => ['RD', 'HO', 'IN', '4K', '5K', '6K', '7K', '8K', '9K'].includes(m))) throw new Error('随机、长条转换或改键 Mod 尚不支持结构分析。');
      const local = score.localEntry ? {source:await readLocalEntry(score.localEntry),cached:true,local:true} : await findLocalSource(score.beatmap.id,score.beatmap.checksum);
      const downloaded = local || await api('/api/beatmaps/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: score.beatmap.id,contextKey:data.analysisContext }) });
      const chart = { ...await analyzeChart(downloaded.source, rate, cvtFlag), cached: downloaded.cached };
      analyses.push({ ...chart, accuracy: score.accuracy, client: score.client });
      if (!chart.cached) await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) { failures.push({ id: score.beatmap.id, message: error.message }); }
    progress(++completed, scores.length);
  }
  const profile = buildManiaProfile(analyses);
  const common = data.abilities.filter(item => ['准度', '稳定性', '速度', '耐力'].includes(item.name));
  const skills = profile.patternProfile.skills.map(skill => ({ name: skill.nameZh, value: skill.tier,
    note: `LeoBlack Pattern · ${skill.sampleCount} 张成绩样本 · ${Math.round(skill.bpm)} BPM · 有效难度 ${skill.difficulty.toFixed(2)}` }));
  const category = profile.patternProfile.categories[0];
  data.abilities = [...common,
    { name: '米键 / 常规', value: profile.rice.tier, note: `${profile.riceSampleCount} 张样本 · Mixed 估算 · 96% 准度标准` },
    { name: '长条', value: profile.noodle.tier, note: `${profile.lnSampleCount} 张样本 · 按原始成绩准度估算，stable 尚未补算 ScoreV2 尾判` },
    { name: '样本主键型', value: category?.nameZh || '样本不足', note: `成功 ${analyses.length} / ${scores.length} 张 · 不用星数猜测键型` },
    ...skills];
  if (!skills.length) data.abilities.push({ name: '细分键型', value: '没有可用样本', note: failures[0]?.message || '已处理谱面中未识别到可评级键型。' });
  data.patternNote = `B50${data.localExtrasEnabled?' + Loved / 坟图成绩 PP 前 50（实际选入 '+sample.localCount+' 张）':''}：LeoBlack Mixed + Pattern 成功 ${analyses.length} / ${scores.length} 张${failures.length ? `；${failures.length} 张未分析，首个原因：${failures[0].message}` : ''}。${sample.notes.join(' ')} ${analyses.some(a => a.algorithm.includes('回退')) ? '部分 Companella 路线使用 Sunny 结果。' : ''}`;
  return data;
}

async function analyzePlayer(userId) {
  const output = $("#analysis-output");
  const mode = $("#mode-select").value;
  const keys = mode === "mania" ? $("#keys-select").value : "all";
  try {
    await localReady;
    const data = await withProgress(output, () => api("/api/bp/analyze", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, mode, keys,localLibrary:isLocalBound() }),
    }));
    output.innerHTML = renderAnalysis(data);
  } catch (error) {
    output.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
}

function metric(label, value, note = "") {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ""}</div>`;
}

function scoreRows(scores, mania) {
  return scores.slice(0, 20).map((score) => `<tr><td>#${score.index}</td><td><a href="${escapeHtml(score.beatmap.url)}" target="_blank" rel="noreferrer">${escapeHtml(score.beatmap.artist)} - ${escapeHtml(score.beatmap.title)}<br /><small>[${escapeHtml(score.beatmap.version)}]</small></a></td><td>${formatPp(score.pp)}</td><td>${formatPercent(score.accuracy)}</td><td>${score.misses}</td>${mania ? `<td>${score.rainbowRatio ? `1:${(1 / score.rainbowRatio).toFixed(2)}` : "-"}</td>` : ""}<td>${escapeHtml(score.mods.join(" ") || "NM")}</td><td>${score.beatmap.stars.toFixed(2)}★</td></tr>`).join("");
}

function renderAnalysis(data, compact = false) {
  const metrics = data.metrics;
  const mania = data.mode === "mania";
  return `<article class="analysis-card profile-card">
    <header class="profile-header"><img src="${escapeHtml(data.user.avatarUrl)}" alt="" /><div><h3>${escapeHtml(data.user.username)}</h3><p>${escapeHtml(data.user.mode)}${mania ? ` / ${escapeHtml(data.keys.toUpperCase())}` : ""} · ${formatPp(data.user.totalPp)}${data.user.globalRank ? ` · 全球 #${data.user.globalRank}` : ""}</p></div><span class="style-badge">${escapeHtml(data.playStyle.label)}</span></header>
    ${data.patternNote ? `<p class="progress-status">${escapeHtml(data.patternNote)}</p>` : ''}
    <div class="metric-grid">
      ${metric("BP 强度", formatPp(metrics.pp))}${metric("星数带", `${metrics.stars.toFixed(2)}★`)}${metric("速度", `${Math.round(metrics.bpm)} BPM`)}${metric("平均准度", formatPercent(metrics.accuracy))}${metric("平均 Miss", metrics.averageMiss.toFixed(2))}${metric("稳定性", `${Math.round(metrics.stability * 100)} / 100`)}
      ${metric("准度 P25", formatPercent(metrics.p25))}${metric("准度中位数", formatPercent(metrics.median))}${metric("准度 P75", formatPercent(metrics.p75))}${metric("平均长度", formatLength(metrics.length))}${metric("每千判定 Miss", metrics.missesPerThousand.toFixed(2))}${mania ? metric("平均黄彩", metrics.rainbow ? `1:${(1 / metrics.rainbow).toFixed(2)}` : "-") : metric("画像标准", `${(data.playStyle.threshold * 100).toFixed(1)}%`)}
    </div>
    <div class="client-row"><div class="client-card"><b>stable / Classic</b><p>${data.clients.stable.count} 张 · ${formatPercent(data.clients.stable.accuracy)} · ${data.clients.stable.averageMiss.toFixed(2)} Miss</p></div><div class="client-card"><b>lazer</b><p>${data.clients.lazer.count} 张 · ${formatPercent(data.clients.lazer.accuracy)} · ${data.clients.lazer.averageMiss.toFixed(2)} Miss</p></div></div>
    <details class="ability-section" ${compact ? "" : "open"}><summary>各项能力分析</summary><div class="ability-grid">${data.abilities.map((item) => `<div class="ability"><span>${escapeHtml(item.name)}</span><b>${escapeHtml(item.value)}</b><p>${escapeHtml(item.note)}</p></div>`).join("")}</div></details>
    ${compact ? "" : `<section class="score-section"><h4>BP 成绩</h4><p class="progress-status">${escapeHtml(data.playStyle.note)} ${escapeHtml(data.pinnedInfluence)}</p><div class="table-wrap"><table><thead><tr><th>BP</th><th>谱面</th><th>PP</th><th>Acc</th><th>Miss</th>${mania ? "<th>黄彩</th>" : ""}<th>Mod</th><th>星数</th></tr></thead><tbody>${scoreRows(data.scores, mania)}</tbody></table></div></section>`}
    ${!compact&&data.extraScores?.length?`<section class="score-section"><h4>额外样本 · Loved / 坟图 PP 前 50</h4><p class="progress-status">按实际判定与 Mod，使用 rosu-pp-js 4.0.1 复算官方 PP 公式。参考值不计入官方排名。</p><div class="table-wrap"><table><thead><tr><th>#</th><th>谱面</th><th>复算参考 PP</th><th>Acc</th><th>Mod</th></tr></thead><tbody>${data.extraScores.map((score,index)=>`<tr><td>${index+1}</td><td>${escapeHtml(score.localEntry?.artist||score.beatmap.artist||'')} - ${escapeHtml(score.localEntry?.title||score.beatmap.title||score.beatmap.id)}<br><small>[${escapeHtml(score.localEntry?.version||score.beatmap.version||'')}]</small></td><td>${formatPp(score.calculatedPp)}</td><td>${formatPercent(score.accuracy)}</td><td>${escapeHtml(score.mods.join(' ')||'NM')}</td></tr>`).join('')}</tbody></table></div></section>`:''}
  </article>`;
}

$("#compare-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const a = $("#compare-a").value.trim();
  const b = $("#compare-b").value.trim();
  const mode = $("#compare-mode").value;
  const keys = mode === "mania" ? $("#compare-keys").value : "all";
  const output = $("#compare-output");
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) { output.innerHTML = `<div class="notice error">请输入两个有效的数字玩家 ID。</div>`; return; }
  output.innerHTML = `<div class="analysis-card progress-card">正在并行分析两位玩家…</div>`;
  try {
    await localReady;
    const request = (userId) => api("/api/bp/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, mode, keys,localLibrary:isLocalBound() }) });
    const [left, right] = await Promise.all([request(a), request(b)]);
    if (mode === 'mania') {
      await enrichMania(left, (done, total, message) => { output.textContent = message?`玩家 A · ${message}`:`玩家 A · LeoBlack 谱面分析 ${done} / ${total}…`; });
      await enrichMania(right, (done, total, message) => { output.textContent = message?`玩家 B · ${message}`:`玩家 B · LeoBlack 谱面分析 ${done} / ${total}…`; });
    }
    output.innerHTML = renderAnalysis(left, true) + renderAnalysis(right, true);
  } catch (error) {
    output.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
});

$("#beatmap-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = $("#beatmap-query").value.trim();
  const output = $("#beatmap-results");
  output.innerHTML = `<div class="empty">正在查询谱面…</div>`;
  try {
    await localReady;
    if ($('#beatmap-source').value === 'local') {
      const all = searchLocal(query);
      const results = all.slice(0,100);
      output.innerHTML = `<p class="progress-status">本地找到 ${all.length} 张，展示前 ${results.length} 张。这里只检索文件信息，不计算难度。BP 分析中仅处理匹配到玩家成绩的谱面。</p>` + results.map(entry=>`<article class="beatmap-card local-map-card"><div><h3>${escapeHtml(entry.artist)} - ${escapeHtml(entry.title)}</h3><p>[${escapeHtml(entry.version)}] · ${entry.mode===3?entry.keys+'K':'其他模式'} · ${escapeHtml(entry.status)} · ${escapeHtml(entry.creator)}</p><small>${escapeHtml(entry.path)}</small></div>${entry.id>0?`<a class="external-link" href="https://osu.ppy.sh/beatmaps/${entry.id}" target="_blank" rel="noopener noreferrer">打开官网 ↗</a>`:''}</article>`).join('');
      return;
    }
    if (!requireLogin()) { output.textContent='官网查询需要 osu! 登录；本地查询无需登录。';return; }
    const data = await api(`/api/beatmaps/search?q=${encodeURIComponent(query)}`);
    output.innerHTML = data.results.length ? data.results.map((set) => `<article class="beatmap-card"><img src="${escapeHtml(set.cover)}" alt="" /><div><h3>${escapeHtml(set.artist)} - ${escapeHtml(set.title)}</h3><p>mapped by ${escapeHtml(set.creator)}</p><div class="difficulty-list">${set.beatmaps.slice(0, 16).map((beatmap) => `<a href="${escapeHtml(beatmap.url)}" target="_blank" rel="noreferrer">${escapeHtml(beatmap.version)} · ${beatmap.stars.toFixed(2)}★${beatmap.keys ? ` · ${beatmap.keys}K` : ""}</a>`).join("")}</div></div><a class="external-link" href="${escapeHtml(set.url)}" target="_blank" rel="noreferrer">打开官网 ↗</a></article>`).join("") : `<div class="empty">没有找到谱面。</div>`;
  } catch (error) {
    output.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
});

loadSession();
