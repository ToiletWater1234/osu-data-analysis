import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDocumentation } from './documentation-review.mjs';
checkDocumentation();
const root = fileURLToPath(new URL('../', import.meta.url));
const template = name => fs.readFileSync(path.join(root, 'templates', name + '.html'), 'utf8');
const pages = [
  { route: '/', label: '首页', file: 'index.html', title: 'osu!数据分析', panel: null },
  { route: '/bp/', label: 'BP 分析', file: 'bp/index.html', title: 'BP 分析 · osu!数据分析', panel: 'analysis' },
  { route: '/compare/', label: '玩家对比', file: 'compare/index.html', title: '玩家对比 · osu!数据分析', panel: 'compare' },
  { route: '/beatmaps/', label: '谱面查询', file: 'beatmaps/index.html', title: '谱面查询 · osu!数据分析', panel: 'beatmap' },
  { route: '/about/', label: '说明', file: 'about/index.html', title: '网站说明 · osu!数据分析', panel: 'about', navigation: false },
];
for (const page of pages) {
  const navigation = pages.filter(item => item.navigation !== false).map(item => `<a class="nav-button${item.route === page.route ? ' active' : ''}" href="${item.route}"${item.route === page.route ? ' aria-current="page"' : ''}>${item.label}</a>`).join('\n');
  const workspace = page.panel ? template(page.panel) : `<section class="home-tools" aria-label="数据分析工具">
    <a class="home-tool-card" href="/bp/"><h2>BP 分析 <span>↗</span></h2><p>查看玩家画像、BP 成绩和键型能力。</p></a>
    <a class="home-tool-card" href="/compare/"><h2>玩家对比 <span>↗</span></h2><p>在相同模式下对比两位玩家的表现。</p></a>
    <a class="home-tool-card" href="/beatmaps/"><h2>谱面查询 <span>↗</span></h2><p>通过歌名、谱面 ID 或链接查找谱面。</p></a>
  </section>`;
  const values = { TITLE: page.title, HOME: page.panel ? '' : template('home'), LOCAL_LIBRARY: page.panel === 'about' ? '' : template('local-library'), WORKSPACE: workspace, NAVIGATION: navigation, LOGIN_URL: '/api/auth/login?returnTo=' + encodeURIComponent(page.route) };
  const html = template('layout').replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
  const destination = path.join(root, 'public', page.file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html);
}
console.log('Built homepage, 3 tool pages and website guide.');
