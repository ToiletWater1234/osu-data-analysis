import { runMixedEstimatorFromText } from './vendor/mania/js/estimator/mixedEstimator.js';
import { analyzePatternFromText } from './vendor/mania/js/patterns/service.js';
import { normalize4kAnalyserDifficulty } from './mania-profile.js';

export function analyzeManiaText(text, rate = 1, cvtFlag = null) {
  if (!/^osu file format v\d+/m.test(text) || !/^Mode\s*:\s*3\s*$/m.test(text)) throw Object.assign(new Error('下载内容不是有效的 osu!mania 谱面。'), { status: 422 });
  const result = runMixedEstimatorFromText(text, { speedRate: rate, cvtFlag, withGraph: false, extendedEstimationRange: true, enableAlwaysShowLNDifficulty: true });
  const report = analyzePatternFromText(text, rate).report;
  if (!Number.isFinite(result.star) || Number(result.columnCount) < 1) throw Object.assign(new Error('该谱面无法计算 Mixed 难度。'), { status: 422 });
  return {
    estDiff: normalize4kAnalyserDifficulty(result.estDiff, result.columnCount),
    columnCount: result.columnCount, lnRatio: result.lnRatio, numericDifficulty: result.numericDifficulty,
    algorithm: result.mixedCompanellaPlan ? 'Mixed / Sunny（Companella 路线回退）' : `Mixed / ${result.actualEstimatorAlgorithm || 'Sunny'}`,
    patternAnalysis: { category: String(report.Category || 'Uncategorised'), modeTag: report.ModeTag,
      clusters: (report.Clusters || []).slice(0, 18).map(c => ({ pattern: c.Pattern, specificTypes: c.SpecificTypes, bpm: Math.round(c.BPM * rate), amount: c.Amount, importance: c.Importance })),
    },
  };
}
