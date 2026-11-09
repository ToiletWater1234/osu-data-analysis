import { CTB_MOD_CHOICES, catchModConflicts, parseCatchMods } from './ctb-table.js';

export function catchModPickerHtml() {
  return `<fieldset class="ctb-mod-picker"><legend>CTB 模组 · 可多选，空选即 NM</legend>
    <div class="ctb-mod-options">${CTB_MOD_CHOICES.map(mod => `<label title="${mod.name}"><input type="checkbox" value="${mod.acronym}" aria-label="${mod.acronym}" /><span>${mod.acronym}</span></label>`).join('')}</div>
    <small class="ctb-selected-mods" aria-live="polite">当前：NM</small>
    <small>EZ / HR 互斥；DT / NC / HT 互斥。HD、FL 保留在组合中，星数以官方返回为准。</small></fieldset>`;
}

export function readCatchModPicker(picker) {
  return parseCatchMods(Array.from(picker.querySelectorAll('input:checked'), input => input.value).join(''));
}

export function updateCatchModPicker(picker) {
  const selected = Array.from(picker.querySelectorAll('input:checked'), input => input.value);
  for (const input of picker.querySelectorAll('input[type=checkbox]')) {
    const conflicts = catchModConflicts(input.value, selected);
    input.disabled = !input.checked && conflicts.length > 0;
    input.closest('label').title = input.disabled ? `与已勾选的 ${conflicts.join(' / ')} 冲突，请先取消该模组。` : CTB_MOD_CHOICES.find(mod => mod.acronym === input.value).name;
  }
  const config = readCatchModPicker(picker);
  picker.querySelector('.ctb-selected-mods').textContent = `当前：${config.mods.join('+') || 'NM'}`;
  return config;
}
