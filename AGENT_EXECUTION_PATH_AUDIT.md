# Agent execution path audit — 0.10.1

基线 `d73a33e`，分支 `codex/agent-stabilization-0.10.1`；开始时 Git 干净。在独立 worktree 中工作，原始 dirty 工作区和 0.10.0 均保留。执行基线 `docs/baseline/AGENT_ARCHITECTURE_STABILIZATION.txt`。本轮没有新增 Tool、Skill、Node、Effect、生成模型、Controller 或 UI。

## 当前正式路径

`createNativeAgent` → `ToolContextLoader` / 原生 Skill 指导 → `AgentOrchestrator.plan` → `agentPlanSchema` → `RecoveryController.validateAndRepair` → 正式 Registry / 引用与依赖预检 → `AgentTransaction` draft → 正式工具编译器 / 共享 CommandSystem → Scene / 原生 Renderer verification → 用户接受 → 一次正式 commit。

| 模块 | 实际职责、状态来源 | 决策 |
| --- | --- | --- |
| AgentToolRegistry | 原生工具、permission、Zod schema、READ/Command 编译器；同实例供上下文、预检、执行 | 保留，唯一执行工具权威 |
| creationCapabilities | 汇总该 Registry、正式 VisualCapability、Graph、程序包和预设；动态投影，不是平行可写 Registry | 修正真实执行映射和 availability |
| NativeSkillRegistry / Runtime | 精确版本内置包与指导；requiredCapabilities 查询同一 Registry | 保留，不授予权限；移除重复工具/依赖校验 |
| Legacy SkillManager | builtin/user 提示偏好及既有 allowedTools | 保留；它不是另一个执行器 |
| ToolContextLoader | 发布相关契约；不改变真实工具权限 | 修复常用 READ 声明，减少无关 bootstrap 契约 |
| Intelligence / Professional / Visual proposals | 专项规划/评价，只返回 Proposal | 保留；调用仍受共享 RecoveryController 限制，不提交 Scene |
| Semantic Action Compiler | 组合已有编译器，Command dry run | 保留；不建立第二种正式提交路径 |
| Registry dry run / 事务步骤验证 / 最终 Scene 验证 | 分别保护参数/语义、逐步 draft 结果、最终累积状态 | 保留三种有明确职责的校验；不是重复权限定义 |
| RecoveryController | 网络、规划 patch、执行局部恢复的统一次数/指纹 | 保留，无新增 Controller，无加预算 |
| CommandSystem / Scene / Renderer / Undo | 唯一正式工程写入、验证和历史链 | 原样保留 |
| 历史 bridge | 非当前 Native 入口，仍有测试消费者 | 不无证据删除 |

源码：`src/ui/native-agent-controller.ts:62` 注册；`:362` metadata；`:370` verify；`:443` prepare；`:551` validate；`:566` inspect；`:586` begin。`src/agent/orchestrator.ts:355` 规划；`src/agent/transaction.ts:18` 唯一 Agent 草稿。`src/agent/native-skill-runtime.ts:198` 只保留可信包/合成 prerequisite 与按实际步骤激活指导。

## 首先复现的错误及证据边界

ERROR A：`outputs/agent-stabilization/before.json` 是旧 `d73a33e` 源码的隔离固定响应重放，直接 WRITE 在规划阶段被含糊拒绝。它不是用户历史 Provider 实测。随后真实 `deepseek-flash` 请求 #5 在同一响应里调用 `inspectComposition`、`getCanvasInfo`；前者成功，后者已注册且为 READ，但不在当前声明。Trace 显示拒绝时 reads=1，limit=12，inspectionRounds=0。因此该次真实失败是声明/可调用目录不一致，**不是次数耗尽，也不是模型试图写 Scene**。历史含糊文案位于旧 `src/agent/orchestrator.ts:643`；实际缺失声明来自 `src/agent/tool-context.ts` 的 bootstrap，旧 overview 却列出全目录名字。

ERROR B：旧 Registry 没有 `shape.rectangle`。隔离 fixture 在 `submitPlan.creation.tasks[0].capabilityId` 注入此字符串，首次拒绝来自旧 `src/agent/creation-planner.ts:196`。对保留的历史 0.10 Trace / 内置 Skill 搜索未找到该字符串。**无法证明用户原始失败时究竟哪份提示或模型内容最早产生它**。没有用 fixture 冒充历史根因，没有添加 shape.rectangle 白名单或注册别名。

重点修复：Planner 不再被强制为基本步骤重复编写 creation 元数据；能力 ID 由实际正式工具推导。显式元数据仍严格校验；未知 ID 可仅按正式目录提供的失败任务替代值局部 patch，再走原验证。源码 `creation-planner.ts:174`、`recovery-controller.ts:300`。

审计结论：已证实的主要故障层是上下文/声明、冗余规划元数据和预算诊断；四配置中没有证据表明正式 Command/Scene 本身失败。保留正式执行链，移除 Native Skill 的平行校验，未重写 Orchestrator/Renderer/Scene。
