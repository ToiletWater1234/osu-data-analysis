import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeManiaText } from '../public/mania-engine.js';
import { buildManiaProfile } from '../public/mania-profile.js';
import { onRequestPost } from '../functions/api/beatmaps/analyze.js';

function chart(keys = 4, ln = false) {
  const objects = Array.from({ length: 1200 }, (_, i) => {
    const spacing = keys === 7 ? 35 : 75;
    const time = 1000 + i * spacing;
    const x = Math.floor(((i + Math.floor(i / 4)) % keys + 0.5) * 512 / keys);
    return `${x},192,${time},${ln ? 128 : 1},0,${ln ? time + spacing * 2 + ':0:0:0:0:' : '0:0:0:0:'}`;
  });
  return `osu file format v14\n[General]\nMode:3\n[Metadata]\nTitle:Test\nArtist:Test\nCreator:Test\nVersion:Test\n[Difficulty]\nCircleSize:${keys}\nOverallDifficulty:8\nHPDrainRate:5\nSliderMultiplier:1.4\nSliderTickRate:1\n[TimingPoints]\n0,300,4,2,1,100,1,0\n[HitObjects]\n${objects.join('\n')}\n`;
}

test('real 4K and 7K note structures produce pattern reports and aggregate ability samples', () => {
  for (const keys of [4, 7]) {
    const report = analyzeManiaText(chart(keys));
    assert.equal(report.columnCount, keys);
    assert.ok(report.patternAnalysis.clusters.length > 0);
    assert.ok(JSON.stringify(report).length > 50);
    const profile = buildManiaProfile([{ ...report, accuracy: 0.99, client: 'lazer' }]);
    assert.equal(profile.sampleCount, 1);
    assert.ok(profile.patternProfile.skills.length > 0);
    assert.ok(profile.patternProfile.skills.every(s => s.tier && s.tier !== '暂无算法'));
  }
});

test('DT changes computed pattern BPM and LN chart is recognized', () => {
  const nm = analyzeManiaText(chart());
  const dt = analyzeManiaText(chart(), 1.5);
  assert.equal(dt.patternAnalysis.clusters[0].bpm, Math.round(nm.patternAnalysis.clusters[0].bpm * 1.5));
  assert.ok(analyzeManiaText(chart(4, true)).lnRatio > 0);
  assert.throws(() => analyzeManiaText('<html>error</html>'), /有效/);
});

test('empty sample does not invent ability levels', () => {
  const profile = buildManiaProfile([]);
  assert.equal(profile.sampleCount, 0);
  assert.equal(profile.rice.tier, '样本不足');
  assert.equal(profile.patternProfile.skills.length, 0);
});

test('chart endpoint requires login before downloads', async () => {
  const result = await onRequestPost({ request: new Request('https://site.test/api/beatmaps/analyze', { method: 'POST', body: JSON.stringify({ id: 1 }) }), env: { SESSIONS: { get: async () => null } } });
  assert.equal(result.status, 401);
});
