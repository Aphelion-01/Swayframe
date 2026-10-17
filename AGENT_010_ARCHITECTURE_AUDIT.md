# Swayframe 0.10 architecture audit

基线 a07a8b2 / 0.9.30；独立分支 codex/reliable-agent-0.10。阅读 0.9.26 根因/演进/覆盖缺口/路线图、0.9.27 执行修复和 0.9.30 恢复结果后，对当前生产路径核验。

| 模块 | 决策 | 当前事实 / 本轮动作 |
| --- | --- | --- |
| Scene/Property/Command/AgentTransaction/Undo/Scope/baseline | KEEP | Native UI 使用单一共享命令草稿；不得重写或绕过 |
| Registry schema / radial fill | KEEP + PATCH | Zod 已派生模型 JSON；radial 正式能力参数已同源。补正式契约输出、语义组合编译 |
| Object resolver | KEEP | existing/selection/stepResult/graphNode 已在预检和真实 draft 使用；不放宽 UUID |
| Dependency/recovery | KEEP + PATCH | 0.9.30 已稳定拓扑、局部 patch、有限预算、重复 hash；补错误协议和记忆/追踪 |
| Creation capabilities / context | REFACTOR | 全工具 schema +能力参数重复加载仍在；改摘要发现与相关 schema按需加载 |
| SkillManager | PATCH | 现有 builtin/user 是提示配置；保留 UI 配置兼容，原生可信机器契约独立加载并接入同一 Runtime |
| Provider adapter | PATCH | HTTP 非2xx正文直接丢弃；JSON/SSE故障仍使用中文message恢复；增加白名单诊断、类型化完整性/Retry-After |
| Command/state verifier | KEEP | 真命令顺序归约最终态已修复；扩展 Skill 输出契约和渲染分层状态 |
| Renderer / visual refinement | KEEP | 原生 render +Vision现有流程；无 Vision明确未验，不将有PNG当复杂目标视觉PASS |
| old bridge | DEFER | 历史 tests 仍消费；不未经消费者核验删除 |
| Third-party skills / marketplace | DEFER | 本轮不执行外部代码、不开放第三方自动执行 |

AGENT-001～006 当前已有修复及回归；AGENT-007未修（全量上下文），008未修（HTTP诊断丢失），009部分修（只精确两种中文错误触发完整计划重试）。历史 Cubic完整plan已丢失仍不可精确重放；保留原始 evidence，不把新fixture冒充历史实测。

阶段门禁和本轮新证据位于 outputs/agent-010；任何 LIVE/视觉结论以实际授权与记录为准。
