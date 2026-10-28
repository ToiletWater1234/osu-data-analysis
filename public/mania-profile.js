// Aggregation ported from the local osu! toolbox; same Mixed + Pattern definitions.
function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function weightedAverage(values, valueOf, weightOf = (_, index) => 1 / Math.sqrt(index + 1)) {
  let total = 0;
  let weightTotal = 0;
  values.forEach((value, index) => {
    const number = Number(valueOf(value, index));
    const weight = Number(weightOf(value, index));
    if (Number.isFinite(number) && Number.isFinite(weight) && weight > 0) {
      total += number * weight;
      weightTotal += weight;
    }
  });
  return weightTotal ? total / weightTotal : 0;
}

function tierName(value) {
  return danLabel(danPartsFromDifficulty(value));
}

const danBaseLevels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "α", "β", "γ", "δ", "ε", "ζ", "η", "θ"];

const danGradeLevels = ["low", "low/mid", "mid", "mid/high", "high"];

function danPartsFromDifficulty(value) {
  const number = Math.max(0, Number(value || 0));
  if (!number) return { base: "", grade: "", label: "sample不足" };
  const baseIndex = Math.max(0, Math.min(danBaseLevels.length - 1, Math.floor(number / 2)));
  const progress = (number / 2) - Math.floor(number / 2);
  const gradeIndex = Math.max(0, Math.min(danGradeLevels.length - 1, Math.floor(progress * danGradeLevels.length)));
  const base = danBaseLevels[baseIndex];
  const grade = danGradeLevels[gradeIndex];
  return { base, grade, label: danLabel({ base, grade }) };
}

function danLabel(dan) {
  const base = String(dan?.base || "").trim();
  const grade = String(dan?.grade || "").trim();
  return base ? `${base} ${grade || "mid"}` : "sample不足";
}

const courseGradeOffsets = new Map([
  ["mid/low", -0.2],
  ["low/mid", -0.2],
  ["mid/high", 0.2],
  ["low", -0.4],
  ["high", 0.4],
  ["mid", 0],
]);

const namedCourseLevels = new Map([
  ["alpha", 11], ["beta", 12], ["gamma", 13], ["delta", 14],
  ["epsilon", 15], ["zeta", 16], ["eta", 17], ["theta", 18],
  ["iota", 19], ["kappa", 20], ["zenith", 10], ["stellium", 10],
  ["yoake", 11], ["yuugure", 12], ["yoru", 13], ["yami", 14], ["yume", 15],
]);

function splitAnalyserDifficulty(value) {
  const parts = String(value || "").split("||").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1 && /\bLN\b|Yoake|Yuugure|Yoru|Yami|Yume/i.test(parts[0])) return { rc: '', ln: parts[0] };
  return { rc: parts[0] || "", ln: parts[1] || "" };
}

const fourKeyLnNamedLevels = new Map([
  [11, "Yoake"],
  [12, "Yuugure"],
  [13, "Yoru"],
  [14, "Yami"],
  [15, "Yume"],
]);

function normalize4kLnCourseLabel(label) {
  const text = String(label || "").trim();
  const numbered = text.match(/\bLN\s*(1\d)\b/i);
  if (!numbered) return text;
  const level = Number(numbered[1]);
  const grade = Array.from(courseGradeOffsets.keys()).find((name) => text.toLowerCase().endsWith(name));
  const course = fourKeyLnNamedLevels.get(level) || `LN ${level}`;
  const boundary = text.startsWith("<") ? "< " : text.startsWith(">") ? "> " : "";
  return `${boundary}${course}${grade ? ` ${grade}` : ""}`;
}

function normalize4kAnalyserDifficulty(value, columnCount) {
  if (Number(columnCount) !== 4) return String(value || "-");
  const parts = String(value || "").split("||").map((part) => part.trim());
  if (parts.length < 2) return normalize4kLnCourseLabel(parts[0] || "-");
  return `${parts[0] || "-"} || ${normalize4kLnCourseLabel(parts[1])}`;
}

function analyserLabelNumeric(label, fallback = null) {
  const text = String(label || "").trim();
  if (!text || /^(?:-|invalid|unknown)/i.test(text)) return Number.isFinite(Number(fallback)) ? Number(fallback) : null;
  const lower = text.toLowerCase();
  const grade = Array.from(courseGradeOffsets.entries()).find(([name]) => lower.endsWith(name));
  const offset = grade?.[1] || 0;
  const boundaryOffset = lower.startsWith("<") ? -0.4 : lower.startsWith(">") ? 0.4 : 0;
  const numbered = lower.match(/(?:reform|regular|ln)\s*(-?\d+(?:\.\d+)?)/i);
  if (numbered) return Number(numbered[1]) + offset + boundaryOffset;
  for (const [name, value] of namedCourseLevels) {
    if (new RegExp(`\\b${name}\\b`, "i").test(lower)) return value + offset + boundaryOffset;
  }
  return Number.isFinite(Number(fallback)) ? Number(fallback) : null;
}

function buildCourseEstimate(samples, kind, standard = {}) {
  if (!samples.length) return {
    difficulty: 0,
    tier: "样本不足",
    accuracy: 0,
    sampleCount: 0,
    passingSampleCount: 0,
    passStandard: standard.passStandard || 0,
    standardName: standard.standardName || "",
  };
  const passing = samples.filter((sample) => sample.accuracy >= sample.passStandard);
  if (!passing.length) {
    return {
      difficulty: 0,
      tier: "未达到过段标准",
      accuracy: Math.max(...samples.map((sample) => Number(sample.accuracy || 0))),
      sampleCount: samples.length,
      passingSampleCount: 0,
      passStandard: samples[0].passStandard,
      standardName: samples[0].standardName,
    };
  }
  const candidates = passing
    .slice()
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, Math.min(3, samples.length));
  const difficulty = weightedAverage(candidates, (sample) => sample.difficulty, (_, index) => 1 - index * 0.2);
  const representative = candidates.reduce((best, sample) => (
    !best || Math.abs(sample.difficulty - difficulty) < Math.abs(best.difficulty - difficulty) ? sample : best
  ), null);
  return {
    difficulty,
    tier: representative?.label || "样本不足",
    accuracy: weightedAverage(candidates, (sample) => sample.accuracy),
    sampleCount: samples.length,
    passingSampleCount: passing.length,
    passStandard: representative?.passStandard || (kind === "ln" ? 0.97 : 0.96),
    standardName: representative?.standardName || "",
  };
}

const maniaPatternTranslations = new Map([
  ["Stream", "单押流 / 乱切"], ["Chordstream", "复合流"], ["Jacks", "叠键"], ["Jack", "叠键"],
  ["Coordination", "LN 协调"], ["Density", "面切"], ["Wildcard", "LN 综合"],
  ["Rolls", "楼梯 / 滚键"], ["Trills", "交互"], ["Minitrills", "短交互"],
  ["Handstream", "三押切"], ["Split Trill", "分手交互"], ["Jumptrill", "双押交互"], ["Jumpstream", "双押切"],
  ["Longjacks", "长叠"], ["Quadstream", "四押切"], ["Gluts", "叠技"], ["Chordjacks", "和弦叠 / 叠键"], ["Minijacks", "小叠"],
  ["Brackets", "括号"], ["Double Stream", "双流"], ["Dense Chordstream", "高密复合流"], ["Light Chordstream", "轻复合流"], ["Chord Rolls", "和弦楼梯"],
  ["Column Lock", "锁列"], ["Shield", "盾 / 盾反"], ["Release", "松键 / 尾判"], ["Inverse", "反键 / 空心 LN"],
  ["JS Density", "双押面切"], ["HS Density", "三押面切"], ["DS Density", "双流面切"],
  ["DCS Density", "高密复合面切"], ["LCS Density", "轻复合面切"], ["Jacky WC", "叠键型 LN 综合"], ["Speedy WC", "速度型 LN 综合"],
]);

function translateManiaPattern(name) {
  const text = String(name || "Uncategorised");
  if (maniaPatternTranslations.has(text)) return maniaPatternTranslations.get(text);
  let translated = text;
  const ordered = Array.from(maniaPatternTranslations.entries()).sort((a, b) => b[0].length - a[0].length);
  for (const [english, chinese] of ordered) translated = translated.replace(english, chinese);
  return translated.replace(/\bTech\b/g, "技术型").replace(/\bHybrid\b/g, "混合型").replace("Uncategorised", "未分类");
}

function buildManiaPatternSkills(analyses) {
  const skillSamples = new Map();
  const categoryCounts = new Map();
  let patternSampleCount = 0;
  analyses.forEach((analysis, analysisIndex) => {
    const pattern = analysis?.patternAnalysis;
    const clusters = pattern?.clusters || [];
    if (!clusters.length) return;
    patternSampleCount += 1;
    const category = String(pattern.category || "Uncategorised");
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    const maxImportance = Math.max(1, ...clusters.map((cluster) => Number(cluster.importance || 0)));
    const parts = splitAnalyserDifficulty(analysis.estDiff);
    const accNerf = analysis.accuracy >= 0.85 ? Math.sqrt(clampNumber((analysis.accuracy - 0.8) / 0.2, 0, 1)) : 0;
    const perMap = new Map();
    clusters.forEach((cluster) => {
      const mainSpecific = (cluster.specificTypes || []).find(([, ratio]) => Number(ratio || 0) >= 0.05)?.[0];
      const name = String(mainSpecific || cluster.pattern || "Wildcard");
      const lnPattern = ["Coordination", "Density", "Wildcard"].includes(String(cluster.pattern));
      const difficulty = analyserLabelNumeric(lnPattern ? parts.ln : parts.rc, lnPattern ? null : analysis.numericDifficulty);
      if (!Number.isFinite(difficulty) || difficulty <= 0) return;
      const importanceRatio = clampNumber(Number(cluster.importance || 0) / maxImportance, 0, 1);
      const candidate = {
        name,
        core: String(cluster.pattern || "Wildcard"),
        label: lnPattern ? parts.ln : parts.rc,
        difficulty: difficulty * (0.78 + 0.22 * importanceRatio) * accNerf,
        bpm: Number(cluster.bpm || 0),
        share: importanceRatio,
        bpIndex: analysisIndex + 1,
      };
      if (!perMap.has(name) || perMap.get(name).difficulty < candidate.difficulty) perMap.set(name, candidate);
    });
    for (const candidate of perMap.values()) {
      if (!skillSamples.has(candidate.name)) skillSamples.set(candidate.name, []);
      skillSamples.get(candidate.name).push(candidate);
    }
  });
  const skills = Array.from(skillSamples.entries()).map(([name, samples]) => {
    const best = samples.slice().sort((a, b) => b.difficulty - a.difficulty).slice(0, 3);
    const difficulty = weightedAverage(best, (sample) => sample.difficulty, (_, index) => [1, 0.8, 0.6][index] || 0.5);
    const representative = best.reduce((current, sample) => (
      !current || Math.abs(sample.difficulty - difficulty) < Math.abs(current.difficulty - difficulty) ? sample : current
    ), null);
    return {
      key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      nameZh: translateManiaPattern(name),
      core: samples[0]?.core || "Wildcard",
      difficulty,
      tier: representative?.label || tierName(difficulty),
      bpm: weightedAverage(best, (sample) => sample.bpm, (_, index) => [1, 0.8, 0.6][index] || 0.5),
      share: weightedAverage(samples, (sample) => sample.share),
      sampleCount: samples.length,
    };
  }).sort((a, b) => b.difficulty - a.difficulty || b.sampleCount - a.sampleCount);
  const categories = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, nameZh: translateManiaPattern(name), count }));
  return { sampleCount: patternSampleCount, categories, skills };
}

function buildManiaProfile(analyses) {
  const valid = analyses.filter((analysis) => analysis?.estDiff && Number(analysis.columnCount) > 0);
  const patternProfile = buildManiaPatternSkills(valid);
  const lnCandidateCount = valid.filter((analysis) => Boolean(splitAnalyserDifficulty(analysis.estDiff).ln)).length;
  const samples = valid.flatMap((analysis) => {
    const keys = Number(analysis.columnCount || 0);
    const labels = splitAnalyserDifficulty(analysis.estDiff);
    const chartSamples = [];

    // Mixed can return both RC and LN ratings for one hybrid chart. Treat
    // those as two observations of the same play instead of forcing the chart
    // into one bucket by LN ratio. A one-sided Mixed result contributes only
    // the side that is actually present.
    const riceDifficulty = analyserLabelNumeric(labels.rc, analysis.numericDifficulty);
    if (labels.rc && Number.isFinite(riceDifficulty)) {
      chartSamples.push({
        ...analysis,
        isLn: false,
        label: labels.rc,
        accuracy: Number(analysis.accuracy || 0),
        rawAccuracy: Number(analysis.accuracy || 0),
        difficulty: riceDifficulty,
        passStandard: 0.96,
        standardName: keys === 4
          ? "RF · Mixed 估算 · 96%"
          : keys === 7
            ? "Jinjin Regular · Mixed 估算 · 96%"
            : `${keys}K · Mixed 估算 · 96%`,
      });
    }

    const lnLabel = keys === 4 ? normalize4kLnCourseLabel(labels.ln) : labels.ln;
    const lnDifficulty = analyserLabelNumeric(lnLabel);
    if (labels.ln && Number.isFinite(lnDifficulty)) {
      const scoreV2Accuracy = analysis.scoreV2Accuracy == null
        ? null
        : Number(analysis.scoreV2Accuracy);
      chartSamples.push({
        ...analysis,
        isLn: true,
        label: lnLabel,
        accuracy: Number.isFinite(scoreV2Accuracy) ? scoreV2Accuracy : Number(analysis.accuracy || 0),
        rawAccuracy: Number(analysis.accuracy || 0),
        difficulty: lnDifficulty,
        passStandard: keys === 7 ? 0.95 : keys === 4 ? 0.97 : 0.96,
        standardName: keys === 4
          ? (analysis.client === "stable" && analysis.scoreV2Estimated
            ? "UJ LN · Mixed + stable ScoreV2 估算 · 97%"
            : "UJ LN · Mixed + ScoreV2 · 97%")
          : keys === 7
            ? "Jinjin LN · Mixed 估算 · 95%"
            : `${keys}K LN · Mixed 估算 · 96%`,
      });
    }
    return chartSamples;
  }).filter((sample) => Number.isFinite(sample.difficulty));
  const lnSamples = samples.filter((sample) => sample.isLn);
  const riceSamples = samples.filter((sample) => !sample.isLn);
  const primaryKeys = Number(valid[0]?.columnCount || 0);
  const riceStandard = primaryKeys === 4
    ? { passStandard: 0.96, standardName: "RF · Mixed 估算 · 96%" }
    : primaryKeys === 7
      ? { passStandard: 0.96, standardName: "Jinjin Regular · Mixed 估算 · 96%" }
      : { passStandard: 0.96, standardName: `${primaryKeys || "?"}K · Mixed 估算 · 96%` };
  const lnStandard = primaryKeys === 4
    ? { passStandard: 0.97, standardName: "UJ LN · Mixed 估算 · 97%" }
    : primaryKeys === 7
      ? { passStandard: 0.95, standardName: "Jinjin LN · Mixed 估算 · 95%" }
      : { passStandard: 0.96, standardName: `${primaryKeys || "?"}K LN · Mixed 估算 · 96%` };
  const noodle = buildCourseEstimate(lnSamples, "ln", lnStandard);
  const rice = buildCourseEstimate(riceSamples, "rc", riceStandard);
  const lnDifficulty = noodle.difficulty;
  const riceDifficulty = rice.difficulty;
  const lnRatio = valid.length ? weightedAverage(valid, (analysis) => analysis.lnRatio || 0) : 0;
  const riceAcc = rice.accuracy;
  const lnAcc = noodle.accuracy;
  const riceOverLn = riceDifficulty - lnDifficulty;
  const lnOverRice = lnDifficulty - riceDifficulty;
  let tendency = "RC均衡";
  if (riceSamples.length >= 3 && (riceOverLn >= 2.2 || lnSamples.length < 2)) {
    tendency = riceAcc >= 0.982 ? "RC准度型" : "RC冲分型";
  } else if (lnSamples.length >= 3 && (lnOverRice >= 2.2 || riceSamples.length < 2)) {
    tendency = lnAcc >= 0.982 ? "LN准度型" : "LN冲分型";
  } else if (riceSamples.length >= 2 && lnSamples.length >= 2) {
    tendency = Math.abs(riceAcc - lnAcc) <= 0.01 ? "RC/LN双修" : riceAcc > lnAcc ? "RC稳定/LN短板" : "LN稳定/RC短板";
  } else if (valid.length > 0) {
    tendency = lnSamples.length > riceSamples.length ? "LN样本偏多" : "RC样本偏多";
  }

  return {
    primaryKeys,
    sampleCount: valid.length,
    ratedSampleCount: samples.length,
    analysedSampleCount: valid.length,
    lnSampleCount: lnSamples.length,
    lnCandidateCount,
    lnUnratedSampleCount: Math.max(0, lnCandidateCount - lnSamples.length),
    scoreV2EstimatedSampleCount: lnSamples.filter((sample) => sample.scoreV2Estimated && Number.isFinite(Number(sample.scoreV2Accuracy))).length,
    scoreV2AddedJudgementCount: lnSamples.reduce((sum, sample) => sum + Number(sample.scoreV2AddedJudgements || 0), 0),
    scoreV2AddedJudgementsByGrade: {
      perfect: lnSamples.reduce((sum, sample) => sum + Number(sample.scoreV2AddedPerfect || 0), 0),
      great: lnSamples.reduce((sum, sample) => sum + Number(sample.scoreV2AddedGreat || 0), 0),
      good: lnSamples.reduce((sum, sample) => sum + Number(sample.scoreV2AddedGood || 0), 0),
      ok: lnSamples.reduce((sum, sample) => sum + Number(sample.scoreV2AddedOk || 0), 0),
      meh: lnSamples.reduce((sum, sample) => sum + Number(sample.scoreV2AddedMeh || 0), 0),
      miss: lnSamples.reduce((sum, sample) => sum + Number(sample.scoreV2AddedMiss || 0), 0),
    },
    riceSampleCount: riceSamples.length,
    lnRatio,
    noodle: {
      ...noodle,
    },
    rice: {
      ...rice,
    },
    patternProfile,
    tendency,
  };
}
export { buildManiaProfile, normalize4kAnalyserDifficulty };
