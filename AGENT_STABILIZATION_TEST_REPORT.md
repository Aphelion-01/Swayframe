# Stabilization test report — 0.10.1

不能以门禁通过替代 Agent 正确。下面分开列确定性、真实 Provider 和原生 Renderer 证据。

## 确定性四配置

A 正式 Commands；B 合法固定参数 Tool Adapter；C Native Planner/Executor、关闭可选 Skill；D 完整 Native Agent / Skill。

最小任务：Create Rectangle → Set Fill → Create Text → Set Font → Set Position → 两个 opacity keyframes。每个配置独立空工程，正式 CommandSystem，实际 Runtime 对象 ID / stepResult，单次正式 commit。四者 Scene 对目标字段归一化后完全相同；真实原生 Renderer 720×405 PNG 四文件 SHA256 都为 `b8905082d96995c3a2ceba00c80b3e52e2a349579e8d6a9aa08e3d276711fa60`，foregroundPixels=17030。各自一次 Undo 恢复基线，Redo 恢复结果，Save/Reload 无变化。

证据：outputs/agent-stabilization/offline-stable/report.json、a/b/c/d.png、b-verification.json、对应工程和 session。这是固定合法模型响应实验，**不是四组真实模型成功率**。A 最短且最稳定（无外部规划随机性）；B 同样固定合法参数。C/D fixture 都通过，未证明 Skill 是故障源。

## 必要回归覆盖

| 需求 | 证据 |
| --- | --- |
| 1–4 Rectangle / 未注册 / 不同ID / 映射 | agent-stabilization.test.ts:204、220、237 |
| 5 过期 Skill | :269；native-skill-runtime.test.ts |
| 6–9 READ / 禁止直接WRITE / 调用上限 / 正常预算 | :278、it.each未授权工具、:324、:339、:356、:564 |
| 10–12 Rectangle→Fill / Text→Font / 实际对象绑定 | :471、:515、CONFIG C/D、最小任务四配置 |
| 13 READ→WRITE | :278；agent-execution-recovery.test.ts:612 |
| 14–15 合法任务重排 / 循环拒绝 | :429；非交换写入顺序仍保护，不任意重排 |
| 16 重复错误停止 | :460；agent-autonomous-recovery.test.ts B5 |
| 17 草稿回滚 | :408；无正式 commit |
| 18–19 Undo/Redo / Save/Reload | 四配置 / assertScene |
| 20 真实渲染 | Electron 原生 Renderer 四配置 PNG；真实组合任务 PNG |
| 新增具体失败回归 | getCanvasInfo、精确能力元数据 patch、按需契约、Provider unsupported |

质量门禁最终结果见 quality/typecheck.log、lint.log、test.log、build.log。测试数量以最新日志为准，不用历史数量冒充。未改变 Registry/Transaction 既有 scope、UUID、对象类型、deferred、baseline conflict 保护。

## 真实 DeepSeek

Provider DeepSeek，model `deepseek-flash`。矩形、文字、纯色填充、两个线性 opacity 关键帧、径向渐变矩形＋Cubic 标题均有真实 API 结果和原生渲染。使用保存工程做额外独立检查：independent-scene-checks.json。填充用例名称返回 Rectangle Fill，而提示中的短标签是 Fill；填充/几何/位置断言通过，但不声称命名完全准确。组合 C/D radius/aspect/中间色标选择不同，原请求没有指定这些值；不声称逐像素一致。

| 同一组合任务 | C 无 Skill | D 有 Skill |
| --- | --- | --- |
| 实际请求 | 2 | 1 |
| 输入 tokens | 12058 | 10343 |
| 输出 tokens | 1290 | 934 |
| 耗时 | 6.11s | 4.41s |
| 恢复 | 一次 radialParameters.stops 参数局部 patch，重新通过原验证 | 无 |
| 正式 commit | 1 | 1 |
| 独立 Scene / Render / Undo / Redo / Reload | PASS | PASS |

C 首个模型计划只提供一组5项stop，正式schema要求至少两组10项；预检拒绝，局部模型 patch 只补 stops/失败参数，没有新增任务或更换 UUID。实际恢复后完成。D 首次提交合法。单个 matched pair 不足以证明长期成功率或 Skill 一定更好。

总付费账本：12次，168794输入，5154输出，0 unknown usage，0图片。初次填充失败与两次预算guard保留；最终成功不是抹去失败数据。Vision 复杂重建 NOT TESTED；用户原始 shape.rectangle 历史 prompt 来源 NOT PROVEN。Windows安装运行 NOT VERIFIED，Mac成品及DMG结果另见 RELEASE_MANIFEST.json / packaged-smoke.json。

最终门禁计数：687 tests /158 files PASS；Mac实际成品窗口与preload/renderer PASS、DMG VALID；Windows installer build PASS，实际Windows运行 NOT VERIFIED。参见 quality/quality.json。
