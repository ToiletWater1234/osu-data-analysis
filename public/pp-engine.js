import init, {Beatmap,Performance} from './vendor/rosu-pp/rosu_pp_js.js';
let ready;
export function initPp(){return ready ||= init();}
export function performanceArguments(score){
  const fields=[['perfect','nGeki'],['great','n300'],['good','nKatu'],['ok','n100'],['meh','n50'],['miss','misses']];
  const stats=score.statistics||{};const args={lazer:score.client==='lazer',mods:score.modDetails?.length?score.modDetails:score.mods||[]};let total=0;
  for(const [name,target] of fields){const n=stats[name]??0;if(!Number.isSafeInteger(n)||n<0)throw Error('缺少有效的实际判定数，不能计算成绩 PP。');args[target]=n;total+=n;}
  if(!total)throw Error('没有实际判定数，不按满准度模拟 PP。');
  const speed=(score.modDetails||[]).find(m=>typeof m!=='string'&&['DT','NC','HT','DC'].includes(m.acronym));
  if(speed?.settings?.speed_change)args.clockRate=Number(speed.settings.speed_change);
  if((score.mods||[]).some(m=>['AT','RX','AP','CN','CO','TP','RD','HO','IN','WU','WD','AS','1K','2K','3K','4K','5K','6K','7K','8K','9K'].includes(m)))throw Error('该 Mod 暂不支持成绩 PP 筛选。');
  return {args,total};
}
export function calculateScorePp(source,score){
  const {args,total}=performanceArguments(score);let map,calculator,attributes,difficulty;
  try{
    map=new Beatmap(source);
    if(map.mode!==3||map.isConvert)throw Error('当前仅支持原生 mania 成绩。');
    if(map.isSuspicious())throw Error('谱面结构异常，已跳过。');
    if(total<map.nObjects)throw Error('判定数不足，不使用模拟判定补齐未完成成绩。');
    calculator=new Performance(args);attributes=calculator.calculate(map);difficulty=attributes.difficulty;
    const used=attributes.state;
    if(!used||['nGeki','n300','nKatu','n100','n50','misses'].some(k=>used[k]!==args[k]))throw Error('PP 计算器无法保留这条成绩的实际判定，已跳过。');
    const pp=attributes.pp;if(!Number.isFinite(pp)||pp<0)throw Error('PP 计算结果无效。');
    return {pp,stars:difficulty.stars,engine:'rosu-pp-js 4.0.1',basis:'actual-judgements'};
  }finally{difficulty?.free();attributes?.free();calculator?.free();map?.free();}
}
