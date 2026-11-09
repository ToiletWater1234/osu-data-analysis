# 单项校准 v3 对照记录 · 2026-11-03

本次修正常规及部分 LN 单项严重低估；主段位不改。规则见 [算法说明](algorithm-experiment.md)。这是同一小组参与开发的回归对照，不能当成独立测试集上的精度保证。没有按玩家或谱面身份强制写分。

## 数据与复现

- 玩家由站长指定：MyAngelHyacine（35851725）、ruhgss（26720950）、CapooFanboy（27235859）、[GB]fanqiu（16233412）、Hanenya（16277321）。
- 公开 Tracker snapshot 的前 100 张 bestScores 依本站相同逻辑筛选 4K B50，五人共 250 张实际成绩。99 个不同谱面、117 个谱面／速度组合，全部复算成功；此处没有绑定私有目录或追加 Loved／坟图样本。
- 来源为公开 /api/profiles/:name/snapshot 与 /api/profiles/:id/skills；快照时间保存在回归 fixture。Tracker 的总评级池明显多于 B50，并含历史追踪及可能的导入，不能称为同池精确拟合。
- 压缩事实：tests/fixtures/mania-v3-b50.json.gz（只保留计算所需事实与公开评级，不包含 .osu 原文、令牌或完整个人资料）。测试：node --test tests/mania-corpus.test.mjs。
- 五人两张主段位的标签、连续刻度与样本数均与 Git 307752f 的 v2 基线逐项一致。局部难度输入不改动，旧 Mixed + Pattern 与其原存档不改动。

## 常规粗粒度对照

每格为“本站 v3 / Tracker（差值，整级）”。Tracker 的 Jack / Speed / Tech 不等于本站每个具体键型，因此只取实际检出的同类最强子项作宽类代理：叠键组 Jacks / Longjacks / Chordjacks / Minijacks；速度组 Stream / Trills / Minitrills；技术组其余复合流、切、楼梯、对切、对拍、叠技。不是给每个子项贴相同的父类分数；耐力没有同义具体键型，未作差值断言。标签的 low／mid-low／mid／mid-high／high 按 -0.4／-0.2／0／+0.2／+0.4 级读取。

| 玩家 | 叠键组 | 速度组 | 技术组 |
| --- | --- | --- | --- |
| MyAngelHyacine | Beta mid / gamma (-1) | Beta mid/high / beta++ (-0.19) | Beta mid/high / gamma-- (-0.31) |
| ruhgss | Delta mid/high / epsilon-- (-0.47) | Delta low / delta++ (-0.85) | Delta mid / epsilon-- (-0.51) |
| CapooFanboy | Gamma high / gamma- (0.67) | Delta low / gamma++ (0.23) | Delta mid/low / delta-- (0.21) |
| [GB]fanqiu | Delta low / delta+ (-0.56) | Delta mid / delta+ (-0.17) | Delta mid / delta++ (-0.38) |
| Hanenya | Epsilon mid/low / zeta-- (-0.76) | Epsilon mid/low / epsilon++ (-0.63) | Epsilon mid/low / zeta-- (-0.75) |

15 组代理比较的绝对差均不超过一级；这不证明每个单项或其他玩家均在一级内。

## 具体低估项的变化

| 玩家 | 单乱 | 放手 | 盾 | 反键 |
| --- | --- | --- | --- | --- |
| MyAngelHyacine | Reform 9 high → Beta mid/high | LN 7 high → LN 11 mid | LN 5 mid → LN 11 mid/low | < LN 5 mid → LN 10 high |
| ruhgss | Alpha mid/low → Delta low | LN 10 low → LN 14 mid/high | LN 9 low → LN 14 mid/low | LN 7 mid/high → LN 14 mid/low |
| CapooFanboy | Alpha mid → Delta low | LN 10 mid/low → LN 14 mid/low | LN 9 low → LN 13 mid/high | LN 8 mid/high → LN 14 low |
| [GB]fanqiu | Alpha mid → Delta mid | LN 11 low → LN 14 high | LN 9 low → LN 14 mid | LN 7 high → LN 14 mid/high |
| Hanenya | Alpha high → Epsilon mid/low | LN 12 low → Hypersovae LN 16 mid | LN 10 mid/high → Hypersovae LN 16 mid/low | LN 10 mid → Hypersovae LN 16 mid/low |

LN Coordination 与 Tracker LN Technical 在本组作五项近似检查，差距也未超过一级；它们仍非严格同义。没有把 Tracker Walls / Hybrid / Speed 分别等同于本站面切／面条综合／速度型面条综合，更没有用不同定义的标签宣称所有 LN 子项均达到一级精度。LN 的普通按下负担在 Sunny 的 hold-bearing 区间中保留，新规则进一步结合同段 RC 相对负担，未将两个段位刻度相加。

## 来源

参考仓库固定提交 b2b3009cf086e1b5d54777e606a7b8cedfbfca67：

- [Tracker 单项与评级池](https://github.com/aleju03/mania-hub/blob/b2b3009cf086e1b5d54777e606a7b8cedfbfca67/docs/features/skill-ratings.md)
- [Tracker 段位及混合谱面计分](https://github.com/aleju03/mania-hub/blob/b2b3009cf086e1b5d54777e606a7b8cedfbfca67/docs/features/dan-estimates.md)
- [Tracker 玩家评分实现](https://github.com/aleju03/mania-hub/blob/b2b3009cf086e1b5d54777e606a7b8cedfbfca67/algorithms/player/skill-ratings.ts)
- [MyAngelHyacine 的公开评级](https://api.mania-tracker.com/api/profiles/35851725/skills)
- [ruhgss 的公开评级](https://api.mania-tracker.com/api/profiles/26720950/skills)
- [CapooFanboy 的公开评级](https://api.mania-tracker.com/api/profiles/27235859/skills)
- [[GB]fanqiu 的公开评级](https://api.mania-tracker.com/api/profiles/16233412/skills)
- [Hanenya 的公开评级](https://api.mania-tracker.com/api/profiles/16277321/skills)

只参考其按技能分开、成绩池去重、Acc 信用连续衰减和混合图双侧负担的设计，未复制其 MSD、Prism、固定谱面课程注册表或在线评分作为本站算法依赖。
