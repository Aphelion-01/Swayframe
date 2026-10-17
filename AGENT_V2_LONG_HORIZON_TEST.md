# V2-6 Long-Horizon Execution

## 固定任务与独立断言

| Task | Actions | 场景 |
| --- | --- | --- |
| L1 | 16 | 三对象创建/命名/颜色/位置，后续文字字号96，再修改已有对象与关键帧 |
| L2 | 12 | 两种对象径向渐变的中心/半径/起止颜色、文字后续字号80及颜色、opacity 中间帧、后期位置修改 |
| L3 | 12 | 创建模糊实例、文字后续字号90/颜色、位置关键帧及中间帧、后期填充修改；不宣称非零模糊视觉质量 |

每任务重复 20 次：7 clean、7 后期 stale 确定性恢复、6 后期参数失败 fixture 修复。合计 60 次固定离线重复，39 次实际故障触发（21 确定性、18 fixture 模型修复）。全部完成，正式受保护对象意外修改 0。**不是 60 个独立 LLM 样本。**

执行前检查最新 Scene hash 与 TaskState sceneVersion、resultMap 与已成功动作输出一致。目标 READ 与 WRITE 合计每任务超过5次（多数10次以上），每步参数从当前 Registry resolve；创建/效果/关键帧成功动作 attempts=1。对最终位置、RGB/渐变起止色、文字内容/字号、效果数量、关键帧与动画中间帧另作独立断言，不仅检查退出码。一次 Commit、Undo/Redo 和工程保存重载逐次验证。

## 实际 Renderer

独立 Electron 执行 7 场：三个 V2 长任务、两个 V2 故障长任务、两个实际 Native V1 的 matched subset。7/7 通过；每场0/1/2秒三个实际 PNG，合计21帧；全部有前景像素、目标参数通过、一次提交、Undo/Redo、save/load、保护对象完整。故障确实触发后才计 recovery。

L1 V1 fixture 的15步与 V2的16步差异是已有 linear interpolation 在 V1 fixture 中无需重复 modifyKeyframe；两者独立 goal 断言相同。它不能用来比较模型效率。图片人工检查了 L1/L2/L3 的1秒帧；这是工程与像素输出验证，不是艺术质量评分。

证据：`long-horizon-offline.json`；`electron-offline/report.json`；逐场 `*-trace.json`、`.swayframe`、PNG。

## 本轮真实自然语言长任务

首轮L1/L2分别12/10动作通过；L3的11动作草稿通过目标验证，但451字符goal导致历史标题超过300字符而拒绝提交。原响应、正式未变Scene和失败帧保留。共享AgentTransaction标题边界修复后，原11动作响应离线重放及新10动作真实L3复测各通过目标、真实渲染、单次提交、Undo/Redo、保存重载。原goal未删改，正式CommandSchema未放宽。

真实后期stale与参数Schema故障长任务各12动作通过，恢复前缀/实际IDs保留；两场matched V1未完成（缺propertyId及响应截断），失败记录不隐藏。所有失败保护对象均未改变。这只是三类固定目标的小规模自然语言Smoke，不是足量独立长任务统计。见 `live/report.json`、`live-replay/report.json`、`live-recheck/report.json` 和 `AGENT_V2_6_LIVE_VALIDATION_REPORT.md`。
