# V2-6 Real Provider Validation — Swayframe 1.0.2

用户单独授权本轮 DeepSeek / deepseek-flash：最多20次实际HTTP请求、400000输入/40000输出tokens，每请求max_tokens=2000。仅发送独立合成工程，不发送图片或私人工程。本轮已结束：**11次请求，113767输入/11608输出tokens，未知用量0**。没有沿用V2-5额度，没有为用完剩余额度扩张场景。

## 首轮七场，保留全部失败

| Case | 首轮结果 | HTTP请求 | 证据与原因 |
| --- | --- | --- | --- |
| L1-V2 | PASS | 1 | 12动作，独立目标、Renderer、一次Commit、Undo/Redo、save/load通过 |
| L2-V2 | PASS | 1 | 10动作，渐变/文字/动画独立断言通过 |
| L3-V2 | FAIL | 1 | 11动作草稿正确，但451字符goal生成的历史标题超过共享Command的300字符限制；acceptance被拒绝，正式工程未修改 |
| R-A-V2-L1 | PASS | 1 | 后期写前stale真实触发；确定性恢复1次，不额外调用模型 |
| R-B-V2-L1 | PASS | 2 | 实际参数Schema拒绝后真实模型仅修失败动作；局部模型恢复1次，成功前缀没有重放 |
| L1-V1-matched | FAIL | 1 | 模型setInterpolation遗漏必需propertyId，只给layerId；MISSING_TARGET拒绝，未提交 |
| L2-V1-matched | FAIL | 3 | 第2、3次响应finish_reason=length，2000输出tokens截断；Native明确提示结果不完整，未提交 |

首轮4/7通过、3/7失败，全部10次HTTP200。HTTP成功不代表任务成功。两场V1失败是本轮真实观察，不删除、不改目标，也不将输出截断误报为网络超时。V1 L2用完该场3次预算后没有重跑。原始模型响应、失败、Scene、21张PNG及账本保存在 `outputs/agent-v2-6/live/`。

## L3提交缺陷修复与独立复核

根因位于共享AgentTransaction：原本截断历史标题为500字符，而CommandSchema上限为300。现只在共同提交边界将展示标题限制为300个UTF-16单元，避免切断emoji代理对；完整goal留在TaskState。没有放宽CommandSchema、修改模型意图或绕过Transaction。

先对原始451字符goal及原模型11动作响应做离线重放，**0次新HTTP请求**，真实Renderer、一次Commit、Undo/Redo、save/load通过。其账本明确标识OFFLINE REPLAY，不冒充第二次模型成功。另新增两个回归，覆盖长goal保持及多语言/emoji标题边界。

再在原L3场景预算内发1次新规划请求，完成10动作；相同独立目标与保护对象断言、真实Renderer、一次Commit、Undo/Redo、save/load全部通过。记录独立保存在 `live-recheck/`，累计账本包含首轮10请求与追加1请求，未覆盖首轮。新响应goal较短，因此451字符原响应重放和回归共同证明长度缺陷修复，不能仅以新响应通过代替长标题验证。这是重新运行隔离任务的复核，**不是成功前缀局部恢复样本**。

## 范围与结论

三类V2长任务在修复后的代码均有通过证据，Type A与Type B各只有1个真实恢复样本；不能宣称任意故障100%恢复。首轮结果与修复后复核分开统计，不能重写为首轮5/7或7/7。

对照使用实际Native V1与实际V2、相同goal/初始合成/授权/Provider/model/tools mode、相同10 WRITE+READ可见和可执行目录、相同每场3次上限及2000输出上限；关闭Skill、视觉和Failover。仅为matched执行子集，**不是完整V1产品体验或统计优势证据**。Blur场景只验实例存在及默认radius=0，不宣称非零模糊视觉质量。

本轮所有失败和成功场景保护对象均保持，失败场景正式提交0。真实修复、离线边界和质量门禁通过，但独立重复样本、正式用户Canary、跨重启续跑与完整V1体验仍未验证。**正式Canary及替换V1仍NOT READY，默认V1不变。** 费用按实际账户计费，没有虚构金额。
