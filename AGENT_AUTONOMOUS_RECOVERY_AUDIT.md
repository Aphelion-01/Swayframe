# Agent Autonomous Recovery Audit — 0.9.30

执行基线：用户提供的 Autonomous Agent Recovery System 提示词。工作区为独立 `codex/autonomous-agent-recovery-0.9.30` 分支，基线 `0b90770`（0.9.29），不清理原工作区。

## 真实故障链

本地已保存的历史会话 `635fd63b-49a0-47d6-a83a-819fffef327c` 显示：`analyzeTypography` 返回 `SCHEMA_INVALID / preflight / creation.tasks.dependencies / 任务依赖与执行顺序不符 / recoverable:false`，内部包含 attempts 0、1。外层另有“创作任务必须恰好覆盖每个计划步骤”。

`cause.producer` 是分析服务名称，不是已确认的 task ID。保留下来的 500 字符 fingerprint 前缀含 s1/createText（Cubic、Times New Roman、110）和 s2/setFont 的 stepResult 引用，但完整 task 表、steps、error 都被旧 `safeValue` 深度限制替换成 `[omitted]`；外层 diagnostics.plan 为 null。因此无法判断原 task 实际依赖、完整执行顺序、两次是否只改了 creation 元数据。不得将受控样本冒充历史完整重放。

源码证据：原 Registry 与 creationPlanner 分别检查依赖；Intelligence 首次验证可恢复，第二次失败统一包装 recoverable:false；其 fingerprint 只看 steps，遗漏 creation；完整 diagnostics 又被塞入 tool feedback，经字符串截断反馈给上层。计划纠错常重发全量工具/历史，上下游无法稳定区分缺能力、顺序错误、循环和无效 UUID。

## 已修复

单一 dependency-graph 校验器处理 task/stepResult 边、唯一所有者、缺失/自引用/循环、实际 step 顺序和产出类型。RecoveryController 共享分类、稳定 SHA-256 指纹、有限局部计划修复、执行期失败步骤预算及分阶段请求预算。Intelligence 只输出 Proposal；修复再次通过原生注册表、Creation 能力/策略/权限预检。

不交换修改操作或改变 READ 所观察的 Scene 快照。专业建议保留 referenceAnalysis 在 Proposal 外层，不误当严格 AgentPlan 字段。局部模型 patch 只能改变依赖/分配元数据和失败步骤参数，不能改工具、能力、目标工作量或权限。无法安全修复时终止草稿。

计数边界也已修复：AIProviderManager.chatOnce 每次只调用一个 provider；允许的 fallback 在下一次被计数的请求发生。RecoveryController 为初始规划、专业建议、执行恢复、视觉检查分别计数，保留应用每日 token 门禁。

## 证据边界

`outputs/autonomous-recovery-030/historical-session.json` 是脱敏旧记录。B1 使用真实前缀构造的受控完整样本，原历史完整重放标记 NOT VERIFIED。当前真实模型测试为 4 个独立测试工程，不是对原练习图的完整视觉复刻，不能据此保证任意提示词成功。
