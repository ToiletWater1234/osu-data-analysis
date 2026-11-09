import { calculate } from './vendor/manialivedan/js/lib/rework/sunnyAlgorithm.js';
import { calculateLN } from './vendor/manialivedan/js/lib/rework/sunnyWindowAlgorithm.js';
import { OsuFileParser } from './vendor/manialivedan/js/lib/parser/osuFileParser.js';
import { computeSegments, estimateRange } from './vendor/manialivedan/js/app/segment.js';
import { applyVibroToSegments } from './vendor/manialivedan/js/app/vibro.js';
import { formatRc, formatLn } from './vendor/manialivedan/js/app/dan.js';
import { parseOsuManiaFromText } from './vendor/mania/js/parser/patternOsuParser.js';
import { find } from './vendor/mania/js/patterns/findPatterns.js';
import { runMixedEstimatorFromText } from './vendor/mania/js/estimator/mixedEstimator.js';
import { limitSegments } from './segment-limits.js';

const LN_CORES = new Set(['Coordination', 'Density', 'Wildcard']);
export const SEGMENT_VERSION = 'segments-v3';

// Interval unions prevent repeated/overlapping Pattern matches from multiplying
// the number of judgement units attributed to a skill.
export function unionRanges(ranges) {
  const output = [];
  for (const [from, to] of ranges.filter(([a,b]) => b > a).sort((a,b) => a[0]-b[0])) {
    const last = output.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else output.push([from, to]);
  }
  return output;
}
function contains(ranges, time) {
  let lo = 0, hi = ranges.length;
  while (lo < hi) { const mid = (lo+hi) >>> 1; if (ranges[mid][1] <= time) lo = mid+1; else hi = mid; }
  return lo < ranges.length && ranges[lo][0] <= time;
}
function unitsIn(notes, from, to) {
  // Half-open intervals assign a boundary note to exactly one segment.
  return notes.filter(n => n.t >= from && n.t < to);
}
function patternRanges(text) {
  const chart = parseOsuManiaFromText(text);
  const offset = chart.FirstNote;
  const groups = new Map();
  for (const p of find(chart)) {
    const name = p.SpecificType || p.Pattern;
    if (!groups.has(name)) groups.set(name, { name, core: p.Pattern, ranges: [] });
    groups.get(name).ranges.push([p.Start + offset, p.End + offset]);
  }
  return [...groups.values()].map(g => ({ ...g, ranges: unionRanges(g.ranges) }));
}

// Difficulty boundaries alone cannot detect a same-difficulty change of pattern.
// Add boundaries when a stable, dominant Pattern changes across 2-second bins.
export function splitPatternTransitions(segments, groups, notes, start, end) {
  const transitions = [];
  let previous = null, run = 0;
  for (let t = start; t < end; t += 2000) {
    const batch = unitsIn(notes, t, Math.min(t+2000, end));
    const ranked = groups.map(g => ({ name:g.name, count:batch.filter(n => contains(g.ranges,n.t)).length }))
      .sort((a,b) => b.count-a.count);
    const current = batch.length >= 8 && ranked[0]?.count / batch.length >= 0.65 ? ranked[0].name : null;
    if (current === previous) run += 1;
    else {
      if (current && previous && run >= 2) transitions.push(t);
      previous = current; run = 1;
    }
  }
  return segments.flatMap(seg => {
    const cuts = transitions.filter(t => t-seg.from >= 4000 && seg.to-t >= 4000);
    if (!cuts.length) return [seg];
    const points = [seg.from, ...cuts, seg.to];
    return points.slice(0,-1).map((from,i) => ({from,to:points[i+1]}));
  });
}

export function analyzeSegmentedManiaText(text, rate = 1, cvtFlag = null) {
  if (!/^osu file format v\d+/m.test(text) || !/^Mode\s*:\s*3\s*$/m.test(text)) throw Error('下载内容不是有效的 osu!mania 谱面。');
  if (!Number.isFinite(rate) || rate < 0.25 || rate > 3 || cvtFlag) throw Error('该速度或转换 Mod 不支持分段试用算法。');
  const parser = new OsuFileParser(text); parser.process();
  const parsed = parser.getParsedData();
  const keys = Number(parsed.columnCount);
  if (![4,6,7].includes(keys)) throw Error('分段试用目前支持 4K、6K、7K；其他键数可选择旧算法。');
  const rawNotes = parsed.noteStarts.map((t,i) => ({t,c:parsed.columns[i],
    end:parsed.noteEnds[i],ln:(parsed.noteTypes[i]&128)!==0})).sort((a,b)=>a.t-b.t);
  if (rawNotes.length < 2 || rawNotes.length > 30000) throw Error('谱面音符数超出分段试用范围（2–30000）。');
  const start = rawNotes[0].t;
  const end = Math.max(...parsed.noteEnds.filter(n => n >= 0), rawNotes.at(-1).t) + 1;
  if (end-start > 15*60*1000) throw Error('分段试用暂不处理超过 15 分钟的谱面。');
  const rc = calculate(text, rate, null, null, {withMeta:true,withGraph:true}, parser);
  if (!Number.isFinite(rc.star)) throw Error('无法计算局部 RC 难度。');
  const ln = calculateLN(text, rate, null, null, {}, parser);
  const state = { text, mods:{rate,odFlag:null,cvtFlag:null}, keys,
    start,end,graph:rc.graph, rcFactor:rc.totalNotes/(rc.totalNotes+60),
    lnFactor:Number.isFinite(ln?.totalNotes)&&ln.totalNotes>0 ? ln.totalNotes/(ln.totalNotes+60) : rc.totalNotes/(rc.totalNotes+60),
    lnMinStar:0 };
  const groups = patternRanges(text);
  // Keep a bounded amount of work by merging adjacent ranges before their final
  // estimates. No change to the v2 headline inputs or segmentation boundaries.
  let ranges = computeSegments(state) || [];
  ranges = limitSegments(splitPatternTransitions(ranges, groups, rawNotes, start, end));
  const units = [];
  rawNotes.forEach((n,i) => {
    units.push({id:i*2,t:n.t,ln:n.ln,tail:false});
    const tail = n.end;
    if (n.ln && Number.isFinite(tail) && tail > n.t) units.push({id:i*2+1,t:tail,ln:true,tail:true});
  });
  const segments = ranges.map((range,index) => {
    const local = Object.hasOwn(range,'rc') ? range : estimateRange(state,range.from,range.to);
    const batch = unitsIn(units, range.from, range.to);
    const heads = batch.filter(n => !n.tail);
    const patterns = groups.flatMap(g => {
      const lnPattern = LN_CORES.has(g.core);
      const matches = batch.filter(n => contains(g.ranges,n.t) && (!lnPattern || n.ln));
      const selected = matches.filter(n => !n.tail);
      const clips = unionRanges(g.ranges.map(([a,b]) => [Math.max(a,range.from), Math.min(b,range.to)]));
      if (!selected.length) return [];
      return [{name:g.name,core:g.core,kind:lnPattern?'LN':'RC',
        stableUnits:selected.map(n=>n.id),lazerUnits:matches.map(n=>n.id),
        share:selected.length/Math.max(1,heads.length),
        durationMs:clips.reduce((sum,[a,b])=>sum+b-a,0)/rate}];
    });
    return {index,from:range.from,to:range.to,durationMs:(range.to-range.from)/rate,
      rc:Number.isFinite(local.rc)?local.rc:0,ln:Number.isFinite(local.ln)?local.ln:0,
      rcLabel:formatRc(local.rc,keys),lnLabel:formatLn(local.ln,keys),
      stableUnits:heads.map(n=>n.id),lazerUnits:batch.map(n=>n.id),
      lnStableUnits:heads.filter(n=>n.ln).map(n=>n.id),lnLazerUnits:batch.filter(n=>n.ln).map(n=>n.id),
      lnRatio:heads.length?heads.filter(n=>n.ln).length/heads.length:0,patterns};
  });
  applyVibroToSegments(segments, rawNotes);
  const mixed=runMixedEstimatorFromText(text,{speedRate:rate,withGraph:false,extendedEstimationRange:true,enableAlwaysShowLNDifficulty:true});
  const labels=String(mixed.estDiff||'').split('||').map(s=>s.trim());
  const lnOnly=labels.length===1&&/\bLN\b|Yoake|Yuugure|Yoru|Yami|Yume/i.test(labels[0]);
  return {algorithm:'Mixed 整图标尺 + Sunny 局部分布 + 键型占比评分（试用）',algorithmVersion:SEGMENT_VERSION,
    columnCount:keys,lnRatio:rc.lnRatio,estDiff:[formatRc(rc.star,keys),formatLn(ln?.star,keys)].filter(Boolean).join(' || '),
    totalStableUnits:rawNotes.length,totalLazerUnits:units.length,
    wholeRc:rc.star,wholeLn:Number.isFinite(ln?.star)?ln.star:0,
    wholeMapLabels:{RC:lnOnly?'':labels[0]||'',LN:lnOnly?labels[0]:labels[1]||''},segments};
}
