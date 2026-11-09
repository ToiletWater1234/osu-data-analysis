# osu! 数据分析

面向 osu! 玩家的网页分析工具，提供 BP 画像、玩家对比、谱面查询与本地成绩补充分析。目前的逐谱面结构能力分析重点支持 **osu!mania**，其他模式提供基础成绩统计。

[在线使用](https://osu-data-analysis.cn/) · [网站说明](https://osu-data-analysis.cn/about/) · [项目仓库](https://github.com/ToiletWater1234/osu-data-analysis)

> 本项目由玩家独立开发，与 osu! 官方无隶属关系。能力评级和未排名谱面的复算 PP 用于个人分析参考，不等同于官方段位认证，也不会写入账号的官方总 PP。

## 最新更新 · 2026-11-10

增加了 CTB pp 表格的适配，增加 CTB 与 mania 4K 表格行生成功能。

首页并列提供 CTB 与 4K 表格入口。行格式生成集成在原有谱面查询中：自动识别谱面模式，mania 4K 沿用原版七列，CTB 使用含“玩家评价”的八列；支持 CTB 多 Mod 组合、冲突校验，以及带字体、边框和星数配色的富文本复制。

## 功能概览

| 功能 | 说明 |
| --- | --- |
| osu! 授权登录 | 通过 osu! 官网 OAuth 登录，本站不接收 osu! 密码 |
| BP 分析 | 查看 B50 的 PP、准确率、Miss、客户端分布等统计；mania 进一步分析 RC / LN 倾向及键型能力 |
| 玩家对比 | 在相同模式与键数范围下，并列查看两位玩家的画像 |
| 谱面查询 | 按歌名、谱面 ID 或官网链接查询；官网结果自动识别 mania / CTB 并生成 PP 图表行，本地 Songs 仅检索 |
| 本地成绩补充 | 绑定本地目录后，按复算 PP 选取有实际成绩的 Loved / 坟图，补充 mania 能力样本 |
| 图 PP 列表 | 首页并列提供 [mania 4K 图 PP 表格](https://docs.qq.com/sheet/DV0tHRUdvdHZpVEtZ) 与 [CTB 图 PP 表格](https://docs.qq.com/sheet/DV1lNdW5YSXBjR1Bv?tab=BB08J2) |
| 首页管理 | 管理员可编辑轮播标题、图片、超链接、顺序与切换间隔 |

页面均可直接收藏：

| 路径 | 页面 |
| --- | --- |
| `/` | 首页、图片轮播与图 PP 列表 |
| `/bp/` | BP 分析 |
| `/compare/` | 玩家对比 |
| `/beatmaps/` | 谱面查询 |
| `/about/` | 使用说明、算法来源、限制与更新记录 |

## 谱面查询中的表格格式生成

使用方法：进入[谱面查询](https://osu-data-analysis.cn/beatmaps/)，查找谱面后，在对应难度下展开“生成表格格式”；选择或勾选 Mod，点击“生成表格行”，再点击“复制表格格式”，粘贴到目标表格的第一列。CTB 空选 Mod 即为 NM，mania 4K 继续使用原版 Mod 选项。

在官网查询结果的对应难度下展开“生成表格格式”，无需进入单独的 CTB 页面。自动识别实际模式：mania 复用本地原版七列、Mod 选项与目标分页；CTB 前七列不变，第八列为玩家评价。按最新要求，正文不填充白色或浅蓝色，仅星数格保留难度色；一个“复制表格格式”按钮，不再区分双色。即使不填评价，第八个空白格仍保留。字体为微软雅黑 18 磅、居中，带蓝色横边框，不自动填充评价或较难提示色。

CTB Mod 支持 EZ、HD、HR、DT、NC、HT、FL 多选，空选即 NM；EZ / HR 互斥，DT / NC / HT 互斥，前后端均校验。`EZ+DT+FL` 等完整组合通过官方 `POST /beatmaps/{id}/attributes` 计算，不拼接单模组星数。HD / FL 保留在组合中但不保证改变星数，参见 [官方 CTB 实现](https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Catch/Difficulty/CatchDifficultyCalculator.cs)。不支持自定义速度与 lazer 专用调整模组。

CTB ID 使用数值型整数及数字格式 `0`，单元格和官网链接的字体均为 `#0073A7`，不会用文本格式或公式代替编号。CTB 星数向下截断两位，mania 保留原版四舍五入；时长始终按文本 `分:秒` 复制，BPM 与时长按 DT / NC 1.5 倍、HT 0.75 倍换算。富文本剪贴板需 HTTPS / localhost 和权限；纯文本回退不保留样式并会提示。评价草稿仅在当前页面内存保存，不上传；生成不写入腾讯文档，也不是成绩 PP 预测。官方接口失败不会猜测星数，表格行短期缓存最多一小时，不增加持久 KV 写入；OAuth 设置保持不变。原生标准模式、太鼓和本地检索暂不提供表格生成。

## 分析规则

### 固定 B50，按需补充额外 50 张

无论是否绑定本地目录，**基础分析始终使用 B50**。

绑定本地目录后，mania 会从有实际玩家成绩、且本地谱面可读取的 **Loved / Graveyard** 候选中，额外选取最多 50 张：

1. 核对玩家身份、谱面状态、键数及文件校验值。
2. 在本机依据实际判定数、客户端、Mod 与速度设置复算成绩 PP。
3. 同一谱面仅保留 PP 最高的成绩，并排除与 B50 重复的谱面。
4. 按复算 PP 从高到低选取最多 50 张，再运行 Mixed + Pattern 能力分析。

额外样本不足 50 张时，按实际数量处理。**没有成绩的图不分析**；不按星数或原始分数排序，也不会假设满准度补齐判定。候选的 PP 筛选与最终的结构能力分析是两个步骤。

基础统计指标仍来自 B50，额外成绩用于补充 mania 键型与 RC / LN 能力估计。页面会列出选中的额外谱面及复算参考 PP。

### 本地成绩归属

服务器按被分析玩家的数字用户 ID，从 osu! 官方 API 获取其现用名与曾用名名单。本地成绩中的玩家名必须与名单中的名字一致：

- 不区分大小写，不进行相似名字或模糊匹配。
- 若成绩另带数字用户 ID，该 ID 也必须与目标用户一致。
- 玩家对比时，两位玩家分别使用各自的名单。

`scores.db` 通常只记录玩家名，不包含数字用户 ID。因此，本项目使用官方用户资料中的名字名单作归属匹配，不把谱面 ID 或在线成绩 ID 当作玩家 ID。本地文件及其成绩也不等同于官方验证的成绩。

## 使用本地 osu! 文件夹

展开页面上的“本地 osu! 文件夹”，点击“浏览并绑定文件夹”。建议选择 osu!stable 的安装目录：

```text
osu!/
├── Songs/
│   └── 谱面文件夹/
│       └── difficulty.osu
├── osu!.db
└── scores.db
```

在已授权目录中，程序依次寻找 `osu/Songs`、`osu!/Songs`、`Songs`，也可以直接选择 Songs 或手动指定授权目录下的相对子目录。完整路径请粘贴到系统目录选择器的地址栏；普通网页不能仅凭文本路径直接访问磁盘。

| 文件 | 用途 |
| --- | --- |
| `.osu` | 谱面元数据、原始物件结构与版本校验 |
| `osu!.db` | 读取本地谱面状态等信息 |
| `scores.db` | 读取 osu!stable 本地成绩与判定数 |

目录索引、本地文件读取与计算均在浏览器中进行，**本地 `.osu` 原文和成绩数据库不会上传服务器**。确认官方谱面状态时，仅发送必要的谱面 ID；查询公开玩家资料仍会访问本站服务器和 osu! API。

Chrome / Edge 可通过只读目录授权，并在 IndexedDB 中记忆目录句柄、索引及本地成绩。其他浏览器使用文件夹选择回退方式时，跳转或重新打开页面后可能需要重新选择目录。

- 新增或修改谱面、更新成绩后，点击“重新扫描 / 授权”。
- “解除绑定”会清除本站保存的本地索引与成绩。
- 只选择 Songs 而没有成绩库时，仅能补充已找到官方实际成绩、且本地有对应文件的谱面。
- 单张 `.osu` 上限为 2 MB，本地数据库上限为 256 MB。

## 算法与当前限制

| 组件 | 当前用途 |
| --- | --- |
| Mixed 整图标尺 + Sunny 局部分段 + Pattern 占比评分（试用） | 按整图等级、局部相对难度、键型覆盖与实际 Acc 估分，默认选项 |
| LeoBlack Mixed + Pattern（旧版） | 保留原有整图能力模型，可在页面切换并重新分析以对照 |
| rosu-pp-js / rosu-pp 4.0.1 | 通过浏览器 WebAssembly 复算 mania 成绩 PP，筛选额外 Loved / 坟图样本 |
| osu! 官方 API | 获取玩家资料、曾用名、BP、公开成绩及谱面信息 |

rosu-pp 是官方计算逻辑的社区移植，并非官方在线服务。已通过测试核对当前接入的 mania PP 公式、判定字段与部分 Mod 行为；项目固定了依赖版本，不能保证永远与后续官方更新同步。

BP 分析和玩家对比可选择“局部分段＋单项校准（试用）”或“旧版 Mixed + Pattern”。v2 以整图等级为标尺，结合各键型局部相对难度、独立覆盖率与整图 Acc 估分；取消 v1 的 80% 覆盖和准确率最坏下界硬门槛。高占比保留更多难度，低占比降档降权，不把少量高难段直接当作玩家能力。没有回放，真实局部 Acc 仍未知，页面明确标为“估计”。分段明细展示单图标尺、各键型贡献和局部谱面难度；不同键数分别估计。

键型采用站长指定用语：常规、面条、单乱、协调、放手、盾、反键、四押切、对拍、纵叠、大叠、对切、锁手等。原始黄彩保留并分别展示 stable / lazer；画像判断中 lazer 黄彩按 50% 权重、单图贡献封顶 1:1，不直接影响键型等级和官方 PP。

常规段位与面条段位在玩家资料下方以独立主卡片展示，位于基础统计之前，不放在详细情况中。BP 分析、玩家对比及旧版算法使用相同布局；全部键数按键数分组，细分键型保留在能力详情中。

旧算法存档及校验值见 [archives/README.md](archives/README.md)。试用规则、局限、回归反例和 mania-tracker MSD 参考结论见 [docs/algorithm-experiment.md](docs/algorithm-experiment.md)。MSD / Prism 数值尚未接入，不与 Sunny 段位混算。

目前仍有以下限制：

- 仅接入 LeoBlack 项目的部分 JavaScript 模块，未接入 Companella ONNX 推理，相关路线使用现有回退结果。
- stable 的 LN 能力估计仍使用原始准确率，尚未补算 ScoreV2 尾判修正。
- RD、HO、IN、键数转换等部分 Mod 不参与结构能力分析；不支持或无法保留实际判定的 PP 输入会跳过。
- 其他主模式尚未接入逐谱面结构能力算法；“暂无算法”不代表能力为零。
- 暂不支持 lazer 专用本地数据库；官方未返回的曾用名、未保留的本地成绩和官方最近列表之外的历史记录可能无法匹配。
- 本地谱面版本与成绩不一致、状态不明确、判定缺失或未完成的样本可能被排除。
- 分段试用目前支持 4K / 6K / 7K，最多 30000 音符、15 分钟，最终最多 10 段；不支持 EZ / HR / DA 等改变 OD 的 Mod。低覆盖、短段和口径未完全匹配时降权；评分参数尚需真实成绩校准，不代表严格能力下限。
- 玩家对比展示双方各自的成绩样本，并非同一组谱面的逐图对战。

每图最终最多 10 段，通过相邻合并后重算，不因自适应分段过多而丢弃整图。PP 模块使用本地 WebAssembly，浏览器 CSP 显式允许 `wasm-unsafe-eval`；失败时区分初始化、状态、文件匹配与成绩判定原因。

主段位图标：4K 常规与 7K 常规 / 面条使用 Mania Tracker 的固定版本图片；4K 面条使用站长提供曲绘提取的 LN1–LN15 标志。图片不改变评分。来源及许可见 [段位素材](public/vendor/mania-tracker-dans/SOURCE.json)、[MIT 许可证](public/vendor/mania-tracker-dans/LICENSE) 和 [4K 面条素材记录](public/images/ln-dans/SOURCE.json)。

v3 仅校正常规／面条具体键型：低频扣级上限一级，LN 内频率与同段常规负担共同参考；主段位沿用 v2。五名指定玩家的 250 张 B50 成绩已固化回归，粗粒度 Tracker 对照见 [校准报告](docs/calibration-v3-2026-11-03.md)。细分键型定义、成绩池与局部 Acc 的限制不能由同组对照消除。

## 技术结构

前端使用原生 HTML、CSS 与 JavaScript ES Modules。谱面索引、局部分段、Mixed + Pattern 和 PP 计算在浏览器 Web Worker 中运行；后端使用 Cloudflare Workers + Static Assets，负责 OAuth、会话、官方 API 访问和受支持谱面的下载。

```text
.
├── worker.js                 # Worker 入口与 API 路由
├── functions/                # OAuth、玩家、谱面、首页与管理员接口
├── templates/                # 公共布局及页面模板
├── public/                   # 生成页面、浏览器模块、样式与静态资源
│   └── vendor/               # 第三方算法、WASM 与许可证
├── scripts/                  # 页面生成与说明同步检查
├── tests/                    # Node.js 测试
├── wrangler.jsonc            # Cloudflare 部署配置
├── docs-review.json          # 网站说明核对记录
└── package.json
```

## 自行部署

需要 Node.js 24、npm、Cloudflare 账号，以及可管理的域名和 osu! OAuth 应用。

### 1. 获取代码并安装依赖

```sh
git clone https://github.com/ToiletWater1234/osu-data-analysis.git
cd osu-data-analysis
npm install
npx wrangler login
```

### 2. 创建 KV 命名空间

```sh
npx wrangler kv namespace create SESSIONS
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create SITE_CONTENT
npx wrangler kv namespace create OSU_FILES
```

将命令返回的命名空间 ID 填入 `wrangler.jsonc`：

| 绑定 | 用途 |
| --- | --- |
| `SESSIONS` | OAuth 临时状态、登录会话与令牌 |
| `CACHE` | 兼容旧谱面缓存及持久谱面存储的回退路径；当前 BP 临时缓存不写入这里 |
| `SITE_CONTENT` | 首页配置、上传图片与管理员名单 |
| `OSU_FILES` | 符合条件的官方 `.osu` 持久存储 |

### 3. 修改部署配置

仓库中的 `wrangler.jsonc` 对应原站点。自行部署时，应替换为自己的配置：

| 字段 | 应填写的内容 |
| --- | --- |
| `name` | 自己的 Worker 名称 |
| `account_id` | 自己的 Cloudflare 账号 ID |
| `kv_namespaces[].id` | 上一步创建的四个 KV 命名空间 ID |
| `vars.ADMIN_OSU_ID` | 站长的数字 osu! 用户 ID |
| `vars.OSU_REDIRECT_URI` | `https://你的域名/api/auth/callback` |
| `routes[].pattern` | 自己已接入 Cloudflare 的域名，保留 `custom_domain: true` |

保留 `assets.binding = "ASSETS"` 和 `/api/*` 的 Worker 路由配置。

在 [osu! 账号设置](https://osu.ppy.sh/home/account/edit) 中创建 OAuth 应用，回调地址必须与 `OSU_REDIRECT_URI` 完全一致。详见 [osu! OAuth 文档](https://osu.ppy.sh/docs/index.html#registering-an-oauth-application)。

### 4. 核对说明、构建并首次部署

根据自己的域名、站长与实际功能更新 `templates/about.html`，然后执行：

```sh
node scripts/documentation-review.mjs --record
npm test
npm run deploy
```

`npm run deploy` 会先生成静态页面，再发布 Worker 与静态资源。

### 5. 配置 OAuth 密钥

首次部署完成后，执行以下命令，按提示输入 OAuth 应用的 Client ID 与 Client Secret：

```sh
npx wrangler secret put OSU_CLIENT_ID
npx wrangler secret put OSU_CLIENT_SECRET
```

密钥配置在 Cloudflare 中，不要写进仓库。配置后访问自己的域名，测试登录、BP 查询与管理员入口。部署命令参考 [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/commands/)。

### 本地开发

```sh
npm run dev
```

如需本地测试 OAuth，可使用未提交的 `.dev.vars` 配置密钥，并将本地回调地址同时配置到应用与本地 Worker 环境。远程部署的密钥不会自动出现在本地环境，本地和线上 KV 数据也并非同一份。

## 首页与管理员

原站站长为 [MyAngelHyacine（35851725）](https://osu.ppy.sh/users/35851725)，由服务端 `ADMIN_OSU_ID` 绑定数字用户 ID，而非通过显示名授予权限。

只有站长可添加或移除管理员。普通管理员可编辑首页：

- 全局标题，以及 1–20 张轮播图片的标题、链接与顺序。
- 3–15 秒的切换间隔。
- 从 osu! 谱面／谱包链接导入曲绘，自动填写曲名和官网链接，之后可继续修改。
- 上传不超过 2 MB 的 JPG、PNG 或 WebP 图片。

每张图片可设置 HTTP(S) 超链接；留空则不可点击。管理员权限在服务器端校验，前端界面状态不构成授权。

## 缓存与数据保存

| 数据 | 保存方式 |
| --- | --- |
| BP 分析结果 | Cloudflare Cache API，短期缓存约 15 分钟 |
| 官方谱面状态 | 有界实例内存及按查询批次保存的短期 Cache API 缓存 |
| 登录会话 | 服务端 KV，最长 30 天；浏览器使用安全会话 Cookie |
| 首页与管理员配置 | `SITE_CONTENT` KV |
| 符合条件的官方谱面 | `OSU_FILES` KV，当前不设置自动过期时间 |
| 本地目录索引及成绩 | 用户浏览器的 IndexedDB，或当前页面内存 |

服务器只下载或保存已确认状态为 Ranked、Approved、Qualified 或 Loved 的官方谱面。**Graveyard、Pending / WIP、未提交或未知状态的 `.osu` 不在服务器下载和保存**，分析时使用匹配的本地文件。

可重建的临时缓存失败时，按未命中处理；官方谱面保存失败时，已下载内容仍可供当前分析使用。登录、令牌刷新、首页保存及首次持久保存官方谱面仍会消耗 KV 操作额度。Cache API 不保证跨数据中心共享，也不能替代持久存储。

Cloudflare KV 免费额度在账号下共享，当前为每日读取 100,000 次、写入 1,000 次，按 UTC 零点（北京时间 08:00）重置。部署前请核对最新的 [KV 计费规则](https://developers.cloudflare.com/kv/platform/pricing/)，不要将免费额度视为无限存储或无限请求。

## 开发与说明同步

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 根据模板生成首页、三个工具页与说明页 |
| `npm run dev` | 生成页面并启动 Wrangler 本地开发环境 |
| `npm test` | 运行鉴权、成绩匹配、谱面解析、PP 筛选与缓存等测试 |
| `npm run deploy` | 生成页面并部署到 Cloudflare |

修改页面时，编辑 `templates/` 中的源文件，不要只修改生成后的 `public/*.html`。

**每次网站功能更新，都要同步核对 `/about/` 的使用说明、算法来源、限制和更新记录。** 完成核对后执行：

```sh
node scripts/documentation-review.mjs --record
npm test
npm run build
```

构建会检查源码指纹，未完成说明核对时将停止。请勿仅刷新指纹来绕过说明更新。源码指纹包含文件内容，跨平台检出改变换行格式时也需要重新核对。

## 致谢与第三方许可

| 上游项目 | 本项目使用的部分 |
| --- | --- |
| [LeoBlackMT/osumania_map_analyser](https://github.com/LeoBlackMT/osumania_map_analyser) | mania 解析、Mixed 难度与 Pattern 键型等部分模块 |
| [M1ra1Fx/ManiaLiveDan](https://github.com/M1ra1Fx/ManiaLiveDan) | 提交 9ff65f4 的 Sunny RC / LN、分段、时间切片及疑似 Vibro 检测，配合本站适配层 |
| [aleju03/mania-hub](https://github.com/aleju03/mania-hub) | 仅复用 4K 常规及 7K 常规 / 面条段位图片，未接入其数值评分 |
| [MaxOhn/rosu-pp-js](https://github.com/MaxOhn/rosu-pp-js) | v4.0.1 浏览器 WebAssembly 绑定 |
| [MaxOhn/rosu-pp](https://github.com/MaxOhn/rosu-pp) | PP 与难度计算实现，经上述 WASM 包使用 |
| [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) | Wrangler 开发与部署工具 |

第三方算法的许可证保留在 [mania/LICENSE](public/vendor/mania/LICENSE)、[ManiaLiveDan/LICENSE](public/vendor/manialivedan/LICENSE)、[ManiaLiveDan/NOTICE.md](public/vendor/manialivedan/NOTICE.md)、[rosu-pp/LICENSE](public/vendor/rosu-pp/LICENSE) 与 [rosu-pp/ROSUPP-LICENSE](public/vendor/rosu-pp/ROSUPP-LICENSE)。固定文件来源与校验值见 [ManiaLiveDan SOURCE.json](public/vendor/manialivedan/SOURCE.json) 和 [rosu-pp SOURCE.json](public/vendor/rosu-pp/SOURCE.json)。使用或分发相关代码时，请保留对应署名与许可。

玩家、成绩、谱面元数据及曲绘来源于 osu!，相关接口说明见 [osu! API 文档](https://osu.ppy.sh/docs/index.html)。

## 作者与联系

- GitHub：[ToiletWater1234](https://github.com/ToiletWater1234)
- osu!：[MyAngelHyacine](https://osu.ppy.sh/users/35851725)
- B站：[个人主页](https://space.bilibili.com/496872941)
- 邮箱：[864457207@qq.com](mailto:864457207@qq.com)

问题反馈可通过本仓库的 [Issues](https://github.com/ToiletWater1234/osu-data-analysis/issues) 提交。请尽量附上页面位置、操作步骤、游戏模式、Mod 和错误提示，便于复现。
