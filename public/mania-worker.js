import { analyzeManiaText } from './mania-engine.js';
self.onmessage = async ({ data }) => {
  try {
    const analyze = ['segments-v1','segments-v2','segments-v3'].includes(data.algorithm)
      ? (await import('./mania-segment-engine.js')).analyzeSegmentedManiaText : analyzeManiaText;
    self.postMessage({ result: analyze(data.source, data.rate, data.cvtFlag) });
  }
  catch (error) { self.postMessage({ error: error.message || '谱面无法分析。' }); }
};
