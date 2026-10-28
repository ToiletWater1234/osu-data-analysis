import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const recordFile = path.join(root, 'docs-review.json');
function fingerprint() {
  const files = [];
  function visit(relative) {
    const full = path.join(root, relative);
    if (fs.statSync(full).isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) visit(relative + '/' + name);
    } else if (!relative.endsWith('.html') || relative.startsWith('templates/')) files.push(relative);
  }
  for (const name of ['worker.js', 'functions', 'templates', 'scripts', 'public', 'package.json', 'wrangler.jsonc']) visit(name);
  const hash = createHash('sha256');
  for (const name of files.sort()) hash.update(name).update('\0').update(fs.readFileSync(path.join(root, name))).update('\0');
  return hash.digest('hex');
}
export function checkDocumentation() {
  const review = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : {};
  if (review.sourceHash !== fingerprint()) throw Error('网站源码已变化：请同步更新 templates/about.html 的说明与更新记录，再运行 node scripts/documentation-review.mjs --record。');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--record')) {
  fs.writeFileSync(recordFile, JSON.stringify({sourceHash: fingerprint(), reviewedAt: new Date().toISOString()}, null, 2) + '\n');
  console.log('Recorded website documentation review.');
}
