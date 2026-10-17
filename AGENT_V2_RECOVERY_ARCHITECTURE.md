# Agent Core V2-6 Recovery Architecture — 1.0.2

本轮基线为 801008a / 1.0.1，独立分支 `codex/agent-v2-recovery-1.0.2`。普通工程仍默认 Legacy V1。没有新建 Runtime、Planner、Recovery Manager、Capability Registry、Scene 或渲染算法。

## 状态与执行路径

既有 TaskRuntime 唯一持有 TaskState、step 状态和真实 result 引用。路径仍是 ProviderBridge → AgentPlanner → TaskRuntime → EditorAdapter → 实际 Tool Registry → AgentTransaction / CommandSystem → step/final Verification → Renderer → Proposal → 用户接受。Intelligence 无 Scene 写入或提交端口。

每步记录 action、实际 Registry resolvedArguments、attempts、recoveryAttempts、draftVersion、failure 和真实输出 layerId/effectId/keyframeId；状态为 PENDING/READY/RUNNING/RECOVERING/SUCCEEDED/FAILED/CANCELLED。Task 的 completedActions、pendingActions、references 与 Scene hash 在每步更新，读取目标使用当前真实草稿，不靠名称猜测。依赖解析和稳定拓扑排序保留。

## 重放安全

执行前同时记录 Scene hash 与 Transaction evidence。捕获失败后，必须确认事务未关闭且两个证据均未改变，才允许局部恢复。写入已发生或写入结果不确定时终止为 REPLAY_FORBIDDEN / UNSAFE；createShape、addEffect、addKeyframe 不会盲重试。完成的步骤及真实 IDs 保留，不重新生成计划，不重放成功前缀。

该策略是拒绝不确定重放，并非跨进程 exactly-once 协议。应用重启、进程崩溃后的持久续跑、远程幂等键和任意外部副作用未实现。不能宣称永远不可能重复对象。

## 恢复策略

| 情况 | 策略 | LLM |
| --- | --- | --- |
| typed CONTEXT_STALE，草稿写前证据一致 | 重读当前草稿并重新 prepare 失败动作 | 不调用 |
| typed recoverable INVALID_REFERENCE，既有 resultMap 有唯一真实 ID | 重新解析已验证的结果 ID，不改目标语义 | 不调用 |
| typed recoverable COMMAND_REJECTION，明确写前拒绝 | 同一失败动作重试 | 不调用 |
| 实际参数 Schema 失败，目标/能力仍合法 | 仅请求失败动作的参数修复，重新 dry validate | 至多 2 次 |
| network/timeout/429/5xx | 显式启用后可有限重试，遵守 Retry-After | 产品默认 0 次自动重试 |
| 目标不存在/选择不唯一、权限、能力缺失、依赖错误 | 停止并诊断 | 不瞎猜 |
| 写后不确定、正式基线变化、错误计划/不可解析响应、取消、预算耗尽 | 停止，禁用提交 | 不继续 |

模型修复输入只有失败类型 Schema、失败动作、结构化诊断及 goal/draftVersion/completedActions/真实 target 的有界摘要；不发送整 Scene、全工具 Schema 或完整历史。候选不能更换 action ID/type/target/dependencies/property/keyframe/content/shape。相同的规范化非法候选不循环请求，实际 Tool Registry 是参数权威。

## 事务与预算

失败/取消关闭草稿事务。写前安全失败前缀标为 INSPECTABLE，只读检查不能接受；写后污染标为 UNSAFE；取消为 DISCARDED。用户修改正式基线后草稿停止，正式新修改保留。成功由显式接受提交一次共享 Transaction、一次 Undo。真实Smoke发现历史标题截断500与CommandSchema上限300不一致；共享AgentTransaction现仅截断展示标题至300 UTF-16单元并保留emoji完整性，完整goal仍留TaskState，没有放宽正式Schema。

默认每任务：100 actions、2 deterministic recoveries、2 model repairs、3 total model requests、0 Provider retries、180s、300000 input / 40000 output tokens。Planner 和 Repair 显式 maxOutputTokens=2000，真实 HTTP 转成 max_tokens。调用前按 UTF8 JSON bytes + 5000 预留输入，未知用量保留预留，收到用量后核算；预留超限不发送。输出/输入实际用量超限停止后续操作。估算和账户收费不同，不能据此保证固定美元费用。

Runtime 取消/超时抢占等待，即使外部 repair promise 不响应 signal，晚返回也无写入端口。真实产品传输沿用原 ProviderManager/NativeAIService 的取消与计费机制，没有暗中 Failover、协议切换或不可见重试。

## 可观测性与边界

现有隔离 Lab 显示阶段、已完成步数、恢复完成数；成功恢复不再显示历史错误警报。失败保留输入，可查看未完成草稿但不可接受。脱敏导出仅允许明确字段：版本、阶段、真实 IDs、失败 code/field、恢复方法/结果、预算、请求预留/实际 usage、Renderer metadata；不导出文本、参数值、原始模型响应、Scene、图片、Key。

setFontSize 复用既有工具与 Command，让 V2 小范围子集为10 WRITE工具。未开放Skill/Forge/视觉重建、非零Blur Radius编辑、任意Graph/3D。离线及真实Type A/Type B各1次恢复已验证，真实长任务提交缺陷修复后复核通过；样本受限，正式Canary / V1 replacement仍NOT READY。
