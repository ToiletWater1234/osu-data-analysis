# 局部分段试用 v1 · 2026-11-03

## 基线与回退

旧版 Mixed + Pattern 存于 [算法存档](../archives/README.md)。旧引擎与聚合文件保持字节一致，网页选择“旧版 Mixed + Pattern”并重新分析即可回退。新选项是“局部分段（试用）”，浏览器保存选择。对比双方固定使用同一选项，运行中切换只对下一次分析生效。

## 本次实际接入

- ManiaLiveDan 提交 `9ff65f4733dee96c1275416875fa03479aaea43e`：Sunny RC / LN、分段、时间切片、疑似 Vibro 检测。
- 原有 LeoBlack Pattern 的时间区间匹配与原有段位表。按键型变化补充边界，不导入新的徽章、外推 6K 表、ONNX、Prism 或 Etterna 二进制。
- 局部结果描述谱面要求；玩家能力通过全图失分的保守下界筛选，不将整图 Acc 当作局部 Acc。

## 证据规则

1. 保留谱面时间轴，DT / HT 用实际速度换算时长；切片保留跨边界完整 LN 和 Timing Points，Sunny 使用整图长度因子。
2. 原始 Pattern 匹配区间合并为集合。对同一键型重复匹配不会重复增加判定单位；不同键型可重叠，覆盖率不要求相加为 100%。LN 目标单位限定为 LN 的判定。
3. 评级只使用该键型在段内至少占 80% 的段落。RC / LN 总类也按各自音符覆盖率筛选；疑似 Vibro 不参与等级估计。
4. 对每个局部难度阈值，合并所有不低于该阈值的合格段落中属于该键型的判定单位。按 `p = 目标判定单位数 / 全图判定单位数`，计算 `max(0, 1 - (1 - A) / p)`。
5. 判定总数必须与该版本谱面完整单位数一致，原始判定须能重算出 API / scores.db 准确率，否则只展示谱面参考，不输出玩家等级。stable 用头部判定，lazer 试核对头尾单位；不能吻合的客户端 / Mod 口径不强行推断。
6. 至少 30 个目标判定单位、4 秒有效时长。下界须达到 RC 96%、4K LN 97%、7K LN 95%、6K LN 96%。这些是试用筛选规则，不是验证过的心理测量模型。
7. 同图多条成绩最多算一张支持谱面。单图明确标记暂定；有两张以上时使用最高三张中的第二高等级，避免单张极端结果直接抬级。不同键数分开显示。

## 参考 mania-tracker 的 MSD 设计

查阅 `aleju03/mania-hub` 提交 `b2b3009cf086e1b5d54777e606a7b8cedfbfca67` 的 `algorithms/msd/{msd,minacalc,inline,headline}.ts`：

- MinaCalc 输出 Overall / Stream / Jumpstream / Handstream / Stamina / JackSpeed / Chordjack / Technical，并显式传入版本、速度、目标准度与键数。
- 当前主流程对部分键数使用独立 Prism 路径，并有单独 LN skill / LN SSR 路径。4K 的 MinaCalc 调用强制关闭 `lnTailTaps`，不能将其 RC 技能值直接当成 LN 段位。
- 借鉴各技能分开、键数和引擎版本分开的方式。本次 **未接入 MSD / Prism 数值评级**：它们与 Sunny 段位刻度的标定尚未验证，不把这些仓库列作本次实际运行依赖。

源码参考：[MSD 主流程](https://github.com/aleju03/mania-hub/blob/b2b3009cf086e1b5d54777e606a7b8cedfbfca67/algorithms/msd/msd.ts)、[MinaCalc 接口](https://github.com/aleju03/mania-hub/blob/b2b3009cf086e1b5d54777e606a7b8cedfbfca67/algorithms/msd/minacalc.ts)。

## 已知限制与验证

没有回放时局部 Acc 仍未知。少量高难段往往只能获得“证据不足”；这不代表能力为零。局部 Sunny / Pattern 混合段仍可能受其他键型影响，长度因子替换亦可能放大短段，不能等同正式段位测试。疑似 Vibro 为规则标记，不证明玩家使用抖动。

支持 4K / 6K / 7K，单图最多 30000 音符、15 分钟、80 段，后台单图 45 秒超时。异常明确跳过，不暗中替换成旧模型。EZ / HR / DA、随机、变换键型、改键暂不参与试用结构分析。基础 B50、额外 PP 前 50、身份匹配和隐私规则保持原有逻辑，不增加 KV 写入。

测试覆盖小段高难叠、20% LN 的 93.5% 反例、独立样本、判定口径、短段 / Vibro、跨段 LN、时间轴、4K / 7K 合成谱面。尚未用站长实际回放校准模型，不能把合成测试通过描述为现实精度已提升。
