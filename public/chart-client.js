export function analyzeChart(source, rate, cvtFlag) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mania-worker.js', import.meta.url), { type: 'module' });
    const finish = (error, result) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => finish(new Error('谱面计算超时。')), 30000);
    worker.onmessage = ({ data }) => data.error ? finish(new Error(data.error)) : finish(null, data.result);
    worker.onerror = () => finish(new Error('谱面计算模块加载失败，请刷新后重试。'));
    worker.postMessage({ source, rate, cvtFlag });
  });
}
