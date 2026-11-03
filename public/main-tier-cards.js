import {danBadge} from './dan-badges.js';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

export function weightedSkillAbility(skill) {
  return {name:skill.nameZh,value:`${skill.tier}（估计）`,
    note:`${skill.confidence} · ${skill.sampleCount} 张成绩 · 参考覆盖率 ${(skill.evidenceShare*100).toFixed(2)}% · 整图 Acc ${(skill.accuracy*100).toFixed(2)}%。依据整图标尺、局部相对难度与键型占比评分。`};
}

export function mainTierAbilities(skills, keyCounts) {
  return [...new Set(keyCounts)].sort((a,b)=>a-b).flatMap(keys => ['RC','LN'].map(kind => {
    const skill=skills.find(s=>s.keys===keys&&s.name===kind);
    return {...(skill?weightedSkillAbility(skill):{value:'暂无可用成绩',note:'当前样本没有可用于此项估分的成绩。'}),
      name:`${keys}K ${kind==='RC'?'常规':'面条'}段位`,kind,keys,tier:skill?.tier};
  }));
}

export function renderMainTierCards(abilities) {
  if(!abilities?.length)return '';
  return `<section class="main-tier-grid" aria-label="主要段位">${abilities.map(item=>{
    const badge=danBadge(item.keys,item.kind,item.tier);
    return `<div class="main-tier-card${item.kind==='LN'?' main-tier-ln':''}"><div class="main-tier-heading"><div class="main-tier-copy"><h4>${escapeHtml(item.name)}</h4><strong>${escapeHtml(item.value)}</strong></div>${badge?`<img class="dan-badge" src="${escapeHtml(badge.src)}" alt="${escapeHtml(badge.alt)}" height="108" decoding="async" />`:''}</div><p>${escapeHtml(item.note)}</p></div>`;
  }).join('')}</section>`;
}
