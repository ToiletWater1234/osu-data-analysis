const MODE_NAMES = { osu: "osu!standard", taiko: "osu!taiko", fruits: "osu!catch", mania: "osu!mania" };

function number(value) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function average(items, getter, weights = null) {
  if (!items.length) return 0;
  let sum = 0;
  let weightSum = 0;
  items.forEach((item, index) => {
    const weight = weights ? weights(index) : 1;
    sum += number(getter(item)) * weight;
    weightSum += weight;
  });
  return weightSum ? sum / weightSum : 0;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * ratio;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function mods(score) {
  return (score.mods || []).map((mod) => typeof mod === "string" ? mod : mod.acronym).filter(Boolean);
}

function clientFor(score) {
  if(typeof score.is_lazer === 'boolean')return score.is_lazer?'lazer':'stable';
  const scoreMods = mods(score).map((mod) => mod.toUpperCase());
  return scoreMods.includes("CL") || scoreMods.includes("CLASSIC") ? "stable" : "lazer";
}

function misses(score) {
  return number(score.statistics?.miss);
}

function hitCount(score) {
  return Object.values(score.statistics || {}).reduce((sum, value) => sum + number(value), 0);
}

function rainbowRatio(score) {
  const max = number(score.statistics?.perfect);
  const threeHundred = number(score.statistics?.great);
  return threeHundred ? max / threeHundred : max ? 99 : 0;
}

export function mapScore(score, index) {
  const beatmap = score.beatmap || {};
  const set = score.beatmapset || {};
  return {
    index: index + 1,
    id: score.id,
    pp: number(score.pp),
    accuracy: number(score.accuracy),
    statistics: score.statistics || {},
    score: number(score.total_score || score.score),
    misses: misses(score),
    hitCount: hitCount(score),
    rainbowRatio: rainbowRatio(score),
    client: clientFor(score),
    mods: mods(score),
    modDetails: score.mods || [],
    endedAt: score.ended_at || score.created_at || "",
    beatmap: {
      id: beatmap.id,
      checksum: beatmap.checksum || null,
      status: beatmap.status || set.status || 'unknown',
      setId: set.id || beatmap.beatmapset_id,
      artist: set.artist_unicode || set.artist || "",
      title: set.title_unicode || set.title || "",
      version: beatmap.version || "",
      mode: beatmap.mode || "",
      stars: number(beatmap.difficulty_rating),
      bpm: number(beatmap.bpm || set.bpm),
      length: number(beatmap.total_length),
      keys: beatmap.mode === "mania" ? number(beatmap.cs) : null,
      url: `https://osu.ppy.sh/beatmapsets/${set.id || beatmap.beatmapset_id}#${beatmap.mode}/${beatmap.id}`,
    },
  };
}

function clientSummary(scores, client) {
  const selected = scores.filter((score) => score.client === client);
  return {
    count: selected.length,
    accuracy: average(selected, (score) => score.accuracy),
    averageMiss: average(selected, (score) => score.misses),
    missesPerThousand: average(selected, (score) => score.hitCount ? score.misses / score.hitCount * 1000 : 0),
  };
}

function accuracyType(mode, accuracy, rainbow) {
  const thresholds = { osu: 0.95, taiko: 0.97, fruits: 0.99, mania: 0.985 };
  const threshold = thresholds[mode] || 0.97;
  const qualifies = accuracy >= threshold && (mode !== "mania" || rainbow >= 1 / 3);
  return {
    label: qualifies ? "准度型" : "推难度型",
    threshold,
    note: mode === "mania"
      ? `平均准度需达到 ${(threshold * 100).toFixed(1)}%，平均黄彩不差于 1:3。`
      : `该模式平均准度标准为 ${(threshold * 100).toFixed(1)}%。`,
  };
}

function abilityItems(mode, metrics) {
  const common = [
    { name: "准度", value: `${(metrics.accuracy * 100).toFixed(2)}%`, note: "按 BP 排名衰减加权。" },
    { name: "稳定性", value: `${Math.round(metrics.stability * 100)} / 100`, note: `平均 ${metrics.averageMiss.toFixed(2)} Miss。` },
    { name: "速度", value: `${Math.round(metrics.bpm)} BPM`, note: "按 BP 谱面 BPM 加权。" },
    { name: "耐力", value: `${Math.floor(metrics.length / 60)}:${String(Math.round(metrics.length % 60)).padStart(2, "0")}`, note: "按 BP 谱面长度加权。" },
  ];
  const unavailable = {
    osu: ["跳", "串"],
    taiko: ["单色", "复合", "滚奏"],
    fruits: ["小跳", "大跳", "超跳"],
    mania: ["乱切", "双押切", "三押切", "四押切", "双押面切", "三押面切", "叠键 / 叠技", "盾 / 盾反"],
  }[mode] || [];
  if (mode === 'mania') return [...common, { name: '细分键型', value: '等待谱面分析', note: '正在下载完整 .osu 文件并执行 LeoBlack Mixed + Pattern。' }];
  return [...common, ...unavailable.map((name) => ({ name, value: "暂无算法", note: "此模式尚未接入逐谱面结构分析。" }))];
}

export function buildAnalysis(user, rawScores, rawPinned, mode, keys) {
  const limit=50;
  let scores = rawScores.map(mapScore);
  let pinned = rawPinned.map(mapScore);
  if (mode === "mania" && keys !== "all") {
    const wanted = Number(String(keys).replace("k", ""));
    scores = scores.filter((score) => score.beatmap.keys === wanted);
    pinned = pinned.filter((score) => score.beatmap.keys === wanted);
  }
  scores = scores.map((score, index) => ({ ...score, index: index + 1 }));
  const sample = scores.slice(0, limit);
  const weight = (index) => 0.965 ** index;
  const accuracy = average(sample, (score) => score.accuracy, weight);
  const averageMiss = average(sample, (score) => score.misses, weight);
  const missesPerThousand = average(sample, (score) => score.hitCount ? score.misses / score.hitCount * 1000 : 0, weight);
  const rainbow = mode === "mania" ? average(sample, (score) => score.rainbowRatio, weight) : 0;
  const accuracies = sample.map((score) => score.accuracy);
  const spread = percentile(accuracies, 0.75) - percentile(accuracies, 0.25);
  const stability = Math.max(0, Math.min(1, 1 - spread * 10 - missesPerThousand / 18));
  const metrics = {
    pp: average(sample, (score) => score.pp, weight),
    stars: average(sample, (score) => score.beatmap.stars, weight),
    bpm: average(sample, (score) => score.beatmap.bpm, weight),
    length: average(sample, (score) => score.beatmap.length, weight),
    accuracy,
    p25: percentile(accuracies, 0.25),
    median: percentile(accuracies, 0.5),
    p75: percentile(accuracies, 0.75),
    averageMiss,
    missesPerThousand,
    rainbow,
    stability,
  };
  return {
    user: {
      id: user.id,
      username: user.username,
      previousUsernames: Array.isArray(user.previous_usernames) ? [...new Set(user.previous_usernames.filter(name=>typeof name==='string'&&name.trim()).map(name=>name.trim()))] : [],
      avatarUrl: user.avatar_url,
      countryCode: user.country_code,
      globalRank: user.statistics?.global_rank || null,
      totalPp: number(user.statistics?.pp),
      mode: MODE_NAMES[mode] || mode,
    },
    mode,
    keys: mode === "mania" ? keys : "all",
    scoreCount: scores.length,
    pinnedCount: pinned.length,
    metrics,
    playStyle: accuracyType(mode, accuracy, rainbow),
    clients: { stable: clientSummary(sample, "stable"), lazer: clientSummary(sample, "lazer") },
    abilities: abilityItems(mode, metrics),
    scores: scores.slice(0, limit),
    pinnedScores: pinned.slice(0, 12),
    analysisLimit: limit,
    pinnedInfluence: pinned.length ? "置顶成绩已作为玩家主动展示的能力样本单独呈现。" : "该玩家在此模式下没有可用置顶成绩。",
  };
}
