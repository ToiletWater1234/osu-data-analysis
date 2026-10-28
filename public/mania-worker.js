import { analyzeManiaText } from './mania-engine.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: analyzeManiaText(data.source, data.rate, data.cvtFlag) }); }
  catch (error) { self.postMessage({ error: error.message || '谱面无法分析。' }); }
};
