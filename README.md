# osu! Analysis · 自有 Cloudflare 部署

独立 Workers + Static Assets，使用自有域名，无需 Sites。功能沿用在线版：osu! OAuth、BP、mania Mixed + Pattern、玩家对比与谱面查询。

完整谱面的 Mixed + Pattern 计算放在浏览器专用 Web Worker 中，避免普通 Cloudflare 免费套餐的单次 CPU 时间限制。服务端保管 OAuth 密钥与会话、代理谱面下载。算法与在线版相同，原有 Companella 回退和特殊 Mod 限制继续保留。

## 配置

1. `npm install`，然后 `npx wrangler login`。
2. 创建四个 KV namespace：`SESSIONS`（会话）、`CACHE`（短期缓存）、`SITE_CONTENT`（首页内容）、`OSU_FILES`（持久谱面），将 ID 填入 `wrangler.jsonc`。
3. 使用 `npx wrangler secret put OSU_CLIENT_ID` 和 `npx wrangler secret put OSU_CLIENT_SECRET` 配置应用密钥。不要提交实际密钥。
4. Cloudflare 中域名须处于 active 状态，在 routes 添加 `{ "pattern": "osu-data-analysis.cn", "custom_domain": true }` 后 `npm run deploy`。
5. osu! OAuth 应用的回调 URL 设置为 `https://osu-data-analysis.cn/api/auth/callback`。

部署前执行 `npm test`。原 Sites 网站保持不变；旧会话不会迁移，访问新域名需要重新授权。

## 页面

首页 `/` 保留轮播和三个功能入口。BP 分析 `/bp/`、玩家对比 `/compare/`、谱面查询 `/beatmaps/` 是独立 HTML 页面，各自只包含对应功能，使用同域会话。OAuth 成功后返回原工具页面。

公共页面结构保存在 `templates/layout.html`，首页轮播和功能区分别保存在其他模板中。修改模板后执行 `npm run build` 生成 `public/index.html` 与三个子页面。`npm run dev`、`npm run deploy` 会先生成页面。直接调用 Wrangler 发布时，也需要先运行 `node scripts/build-pages.mjs`。

说明页 `/about/` 的源文件为 `templates/about.html`。公共页脚包含 GitHub、B站、osu! 主页、邮箱与说明入口。每次网站更新都须同步核对说明与更新记录，再执行 `node scripts/documentation-review.mjs --record` 记录人工核对，最后构建发布。构建会比较源码指纹，拒绝未同步核对说明的更改；生成的 HTML 不参与指纹。

## 首页与管理员

`ADMIN_OSU_ID=35851725` 固定绑定站长 MyAngelHyacine。只有此 osu! 数字 ID 可以通过 `/api/admin/users` 添加管理员或通过 `/api/admin/users/remove` 撤销权限；普通管理员仅能编辑首页。前端可见状态不参与服务端授权。

站长和管理员登录后，点击首页“管理首页”，设置首页标题、1–20 张轮播图片、各图标题、顺序和 3–15 秒切换间隔。每张图支持输入 osu! 谱面／谱包链接获取官方曲绘，或上传不超过 2 MB 的 JPG、PNG、WebP。`SITE_CONTENT` KV 独立保存轮播配置、上传内容和管理员名单。默认图片来自站长公开 BP 的三张曲绘。访客搜索示例为 `MyAngelHyacine / 35851725`；登录后使用本人用户名和 ID。

每张轮播图可设置 HTTP(S) 超链接，留空则不可点击。通过谱面链接导入时自动生成“作者 — 曲名”和原始官网链接（保留难度锚点），管理员可继续修改。已有曲绘默认链接到谱包官网。切换箭头位于图片两侧中间，底部保留切换圆点，不显示精选编号或暂停按钮。

`OSU_FILES` KV 持久保存实际查询或分析时下载的完整 `.osu` 原文件，不设置过期时间。先检查持久存储，再复用原 7 天缓存，最后才下载；旧缓存命中时自动迁入持久存储。数字 ID 查询在后台下载保存该谱面，歌名搜索不会批量下载所有结果。存储暂不可用或达到配额时，已下载谱面仍可用于当前分析，但不会宣称保存成功。现有来源文件单张限制 2 MB。

## 本地目录与分析范围

首页轮播下方新增“图PP列表”，当前只开放用户提供的 mania 4K 腾讯文档链接。

始终使用 B50。绑定并可读取时，mania 额外选取有实际成绩的 Loved / Graveyard 谱面中，按复算成绩 PP 最高的最多 50 张；与 B50 重复的图不重复计入，同图只保留最高 PP 成绩。没有成绩不分析。基础指标仍是 B50 统计，复算的参考 PP 不计入官方排名。

`pp-engine.js` 使用固定版本 rosu-pp-js / rosu-pp 4.0.1 的 WebAssembly 在本地复算。按实际六类判定、客户端、Mod 与速度设置传入；缺少判定、不完整成绩或需要生成额外判定的输入直接跳过。已将输出与 ppy/osu 的 ManiaPerformanceCalculator 公式核对；筛选按复算 PP，不能退回星数、原始分或满准度假设。候选成绩先复算排序，再对最终 B50 + 最多 50 张执行 Mixed + Pattern。依赖来源与压缩包校验值见 `public/vendor/rosu-pp/SOURCE.json`，保留上游许可证。

本地绑定格式升级为 schemaVersion 2；旧索引须重新扫描，以纠正 stable 数据库 100 / 200 判定字段与 osu! API 统计字段的映射后再启用 PP 筛选。

`local-index-worker.js` 在本地扫描用户授权目录，优先寻找 osu/Songs、osu!/Songs、Songs。通过文件头索引元数据与 MD5，通过 osu!.db 读取本地状态，通过 scores.db 读取 stable 判定成绩。身份名单由服务器按被分析的数字用户 ID 查询官方用户资料，传递 `username` 与 `previousUsernames`（来自 `previous_usernames`）。本地成绩玩家名必须精确匹配现用名或官方曾用名（忽略大小写）；若成绩包含 userId / user_id，还必须与目标用户 ID 一致。缺少有效的目标 ID 或现用名时不纳入本地成绩，不使用登录者或其他对比玩家的名单。scores.db 通常只有名字，并没有数字用户 ID，在线成绩 ID 不能作为用户 ID。

随后核对键数与文件校验值；不存在对应谱面或成绩、未完成、特殊改键/自动 Mod 等不参与扩展样本。官网最近和置顶成绩可补充，但不保证覆盖完整历史；lazer 数据库尚未支持。别名资料随原有 BP 查询获取，不逐条请求，不新增 KV 写入。

Chrome / Edge 通过只读目录句柄绑定，并在 IndexedDB 记忆目录、元数据和本地成绩；不支持时使用 webkitdirectory，当前页面有效。完整绝对路径须在系统选择器地址栏输入，普通网页无法按文本路径直接打开磁盘。相对路径在已授权根目录下解析并拒绝路径穿越。源文件与本地成绩不上传；仅必要的谱面 ID 可发送到 `/api/beatmaps/facts` 确认官方状态。

服务器的谱面来源函数现在要求已验证的 ranked / approved / qualified / loved 状态；坟图、pending / wip、未知或未提交状态一律不下载、不保存，遇到已知旧缓存时删除对应键。受支持的官方谱面仍可使用持久缓存。本地检索只显示元数据，不执行难度分析。

## KV 操作额度

BP 15 分钟缓存改为 Cloudflare Cache API；谱面状态使用有界实例内存与按查询批次的短期 Cache API，不再逐张写 KV。分析响应的 `analysisContext` 允许源文件接口在冷实例中从同一个已缓存分析对象复用官方状态，避免重新下载每张谱面的元数据。缓存对象为公开玩家数据；OAuth 会话与管理员权限仍通过原有鉴权获取，不使用短期缓存作权限判断。

临时缓存读写失败均按未命中处理，不因可重建缓存的失败让整个分析报错。Cache API 缓存仅在相应数据中心可用、可能提前淘汰，不能代替持久存储。KV 继续保存会话、首页配置和符合条件的官方 .osu 文件；新文件、登录和管理操作仍会消耗共享 KV 额度。坟图缓存清理会先检查存在性，避免对不存在的键重复调用 delete。不批量删除旧短期缓存键，原有 TTL 会自行到期。
