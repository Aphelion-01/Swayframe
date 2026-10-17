# Agent Autonomous Recovery Spec — 0.9.30

## 共享流程

Diagnose → deterministic repair → native revalidation → bounded model patch → native revalidation → continue current AgentTransaction → verify → single commit。注册 Tool/Command/Transaction 是唯一执行链；Intelligence / VisualIntelligenceService 仅输出 Proposal。预算、开发者 trace、草稿/UI 状态不进入 Scene。

## 分类与安全边界

| 分类 | 行为 |
|---|---|
| AUTO_REPAIRABLE | 无环且不改变操作/快照语义的稳定拓扑调整；网络暂时故障有限重试 |
| MODEL_REPAIR_REQUIRED | 计划 schema、分配/依赖、循环、工具参数、对象引用和未解决 Step Result 的局部修复；仍须完整校验 |
| USER_ACTION_REQUIRED | 缺失能力、权限/凭据不足、上下文变化；不扩权或替换用户工作 |
| NON_RECOVERABLE | 取消、不安全操作、不可证明原子性的命令失败、结果验证失败；不重放已完成操作 |

保留旧代码兼容性，同时生成 PLAN_SCHEMA_INVALID、PLAN_DEPENDENCY_INVALID、PLAN_CYCLE_DETECTED、STEP_RESULT_UNRESOLVED、TOOL_ARGUMENT_INVALID、OBJECT_REFERENCE_INVALID、CONTEXT_STALE、CAPABILITY_UNAVAILABLE、COMMAND_FAILED、RESULT_VERIFICATION_FAILED、PROVIDER_TRANSIENT_FAILURE、PERMISSION_DENIED、UNSAFE_OPERATION、USER_CANCELLED。分类依据字段和结构化 cause，不靠中文字符串猜测。

## 依赖与解析

Stable Kahn 拓扑排序使用原顺序打破并列，保留 IDs、描述、参数、引用和所有请求工作。WRITE/DESTRUCTIVE/不透明工具相对顺序及 READ 的 Scene 快照边界固定。循环不删除任务；安全模型只能修改现有依赖或任务分配，不得增删步骤或任务。无法满足约束则拒绝。

每次执行首先使用现有 resolver 对实际 draft、已完成 StepResultMap、明确 selection/existing/stepResult 引用进行解析，不猜名字/UUID。未知产出保持 DEFERRED 只到真实创建完成，再验证目标/参数。执行恢复复用现有 draft，失败步骤以外不重放；接受修复前检查原工程仍为同一快照、目标与工具未改变、权限未升级。

## 默认有限预算与配置

agent.recovery：deterministicRepairs=4、planModelRepairs=2、stepModelRepairs=2、executionModelRepairs=8、planningRequests=8、proposalRequests=8、visualRequests=4、providerRetries=1。每阶段请求包括网络重试和服务切换；执行恢复有每步骤及全局双重上限。应用设置 → Agent → 自动恢复预算提供可访问的折叠参数表单。0 可禁用对应阶段。

每日 token 门禁仍由现有 ProviderManager 检查。授权验收另外在发送前实施总请求/token 保守上界，并在真实请求体设置 max_tokens=2000；输出限制参数遵照 [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)。没有把日预算门禁宣称为任意模型调用的精确预付费上界。

## 反馈与日志

recoveryFingerprint = SHA-256(normalized code/phase/task/step/tool/field/arguments/contextVersion)。creation 元数据参与计划 fingerprint；只保存摘要，不能靠截断 JSON 前缀比较。相同失败及候选不继续修复。

给模型仅发送 errorCode/category/phase/task/step/tool/field/reason/expected/received、受影响任务和精确相关工具 schema。开发者 trace 单独保留 before/after、策略、attempt、摘要和校验结果。Session 最多 40 条；history 独立脱敏 trace 通道上限 1 MB，超限明确标记，不把截断数据当完整计划。开发者详情默认折叠，无新常驻按钮。

## 0.10 integration

assertRepairTargets 统一规划和执行的目标保留边界。5xx 通过结构化 status 分类，不靠中文 message；Retry-After 超出 15s 重试窗口则安全停止。RecoveryController.calls 单独记录全部模型尝试（含 professional Proposal、视觉调用及失败），每阶段预算包含网络重试。执行恢复提示加入真实工作记忆及 draft 指纹，不重放完成步骤。验证或原工程冲突失败丢弃草稿。诊断导出默认省略用户内容、图片与参数值，保留错误代码/阶段和真实输出引用。
