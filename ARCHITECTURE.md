# 架构入口

完整规范见 `docs/ARCHITECTURE.md`。上一轮执行基线为 `docs/baseline/TRANSFORM_READABILITY.txt`，按 TP-0→TP-8→VR-0→VR-8 完成轴向、支点与图层/属性可读性。GUI与Agent仍共享Command System，业务修改通过Transaction；之前基线保留用于追溯。

GUI 与 Agent 共用 Command System；复杂操作走 Transaction；Intelligence 仅输出 Proposal。Electron Shell 只增加文件、窗口、菜单、持久化和平台服务，React 与核心不导入 Node/Electron。

审计见 `DESKTOP_MIGRATION_PLAN.md`，交付、验证与限制见 `DESKTOP_ACCEPTANCE.md`、`DESKTOP_KNOWN_LIMITATIONS.md`。

当前新增执行基线为 `docs/baseline/COMPOSITING_GRAPH_CG0_CG12.txt`，CG-0→CG-12 已完成。`Layer.editor.graph` 是唯一效果数据源，效果栈从线性图派生。设计见 `COMPOSITING_GRAPH_DESIGN.md`，验证见 `COMPOSITING_GRAPH_ACCEPTANCE.md`。后续自主冲刺按 `docs/baseline/DEV_SPRINT_V2.txt` 推进，不改写既有核心。


当前UI执行基线为 `docs/baseline/FULL_UI_REDESIGN.txt`，0.7.0已完成三轮改造。设计tokens、共享图标/焦点/键盘组件及工作区偏好边界见 `docs/ARCHITECTURE.md`；审查与验证见 `docs/ui-redesign/RESULT.md`。Project schema仍为0.5.0。

当前执行基线：`docs/baseline/NATIVE_AI_AGENT_V1.txt`。Agent独立应用服务、结构化Tool与共享Command/Transaction闭环；进度见AGENT_IMPLEMENTATION_STATUS.md。

当前执行基线：`docs/baseline/V02_WORKFLOW_OPTIMIZATION.txt`。仅打通已有创作闭环。0.9.4 修复新建/状态清理与零缩放，不扩功能；结果和未验收范围见 `V0.2_WORKFLOW_RESULT.md`。

当前执行基线：`docs/baseline/V02_TIMELINE_INTERACTION.txt`。0.9.9完成Timeline三层树、冻结列、多选排序/关键帧手势、帧时间与共享记录入口、曲线往返及单事务验收；GUI/Agent共用Command/Transaction，UI偏好不进入Scene。审计与结果见`TIMELINE_UX_AUDIT.md`、`TIMELINE_UX_RESULT.md`。

当前执行基线：`docs/baseline/SPATIAL_CAMERA_MODEL.txt`。0.9.16 新增静态网格资产、摄像机光学参数及二维/三维贝塞尔路径直接操控；Project schema 为 0.7.0，兼容旧工程迁移。领域实现及边界见 `docs/ARCHITECTURE.md`，验收见 `SPATIAL_CAMERA_MODEL_RESULT.md`。

## V0.3 Unified Effect Engine

详见 EFFECT_ENGINE_ARCHITECTURE.md、PROGRAMMABLE_EFFECT_SPEC.md、EFFECT_FORGE_AGENT_SPEC.md。VisualCapabilityRegistry 是统一能力协议；Graph 是处理实例唯一数据源，Property 是唯一动画系统。径向渐变复用同一像素算法；自定义包由受控声明式 CPU Runtime 执行并内嵌精确内容哈希。Preview 与 Export 经过同一 CanvasGraphBackend；导出拒绝未解析/未信任/超限效果。Forge Workspace 与效果库独立于 Scene，接受后只生成共享 Command/Transaction。

0.9.18 补齐交互采样预览、真实外部模型生成验收和桌面安装包。停止后恢复完整像素，导出始终完整采样；缓存区分采样倍率，CPU 资源预算不放宽。外部模型包仍经校验、像素反馈与 AgentTransaction。实施与证据见 `EFFECT_BOUNDARIES_RESULT.md`。

V0.4（0.9.19）复用 AgentPlan / Orchestrator / AgentTransaction / Graph / Renderer，增加任务分解契约、真实能力发现、节点/上游分支权限与接受前草稿提案。每次写入与提交均校验实际数据，越界草稿关闭，预览不修改 Scene。入口复用节点 Inspector 与上下文菜单；详细规范与真实 Provider 验证限制见 AGENT_CREATION_RESULT.md、AGENT_PLANNER_SPEC.md、NODE_AND_BRANCH_AI_SPEC.md。


## V0.4 规划可靠性补充（0.9.20）

creationGraphContext 按16,000字符限制提供节点摘要，优先当前授权图层/节点；不嵌入效果包源码、大数组或关键帧列表，保留精确包引用与截断标识，详情仍由现有 READ 工具取得。正式 Project 和 Scope 校验不使用摘要。能力查询支持空格分隔的多个关键词，参数发现明确 gradientStops 的五元组编码。工具定义说明实际坐标和 Graph 自动插入行为，不修改核心算法。

规划最多四轮、十二次只读检查，最后一轮要求提交完整计划。残缺 JSON 或计划结构校验失败各最多请求一次重新生成，并共用原有轮数预算；拒绝内容不执行、不自动改写、不放宽权限，网络失败不自动重试。真实测试使用应用实际 planning/general/default 路由，避免误选列表首个启用供应商。

## 0.9.27 Agent Execution Core Recovery

动态 Fill 契约从正式 ParameterDefinition 派生，声明/校验/编译复用原能力。AgentExecutionError 保留 code/phase/field/target/recoverable；反馈先限制数据再序列化，禁止截断 JSON。validatePlan 使用独立共享 CommandSystem 预演确定操作，READ/Forge外部产物明确 DEFERRED，依赖和范围仍检查，实际执行再对最新 Draft验证。执行恢复总预算2，局部原 step/tool 参数纠正，不重放已成功创建，不放宽scope/基线；取消/非恢复性失败直接丢弃。verifyResults 按命令顺序通过正式 CommandSystem归约最终状态，正式事务一次提交/一次Undo。运行与恢复状态不进入Scene。验收边界和真实请求/画布证据见 AGENT_EXECUTION_REPAIR_RESULT.md。

0.9.30 自主恢复规范见 AGENT_AUTONOMOUS_RECOVERY_SPEC.md；诊断和验证见同前缀 AUDIT / TEST / RESULT。恢复共用现有执行链，界面状态与预算不进入 Scene。

## Swayframe 0.10 Reliable Agent

执行基线 docs/baseline/RELIABLE_AGENT_010.txt。语义动作仅组合已有正式 Command 编译器；NativeSkillRuntime 是可信机器契约/指导层，不是执行器。工具、引用、恢复、Command/Transaction 与 Scene 沿用原链。ToolContextLoader 按需发布权威 schema，权限以 Registry/Scope 为准。每个真实任务维护工作记忆、技能版本/哈希、实际对象绑定、模型调用与分层验证。只有正式接受一次提交；诊断、技能开关、上下文和预算均在 Scene 外。详见 AGENT_EXECUTION_CONTRACT_SPEC.md、SWAYFRAME_SKILL_RUNTIME_SPEC.md、AGENT_010_RESULT.md。


## Agent stabilization 0.10.1

已有 creationCapabilities 是 Available Capability Catalogue 的动态投影；Tool/Skill/Planner 引用同一 AgentToolRegistry，capabilityId→executionTools 可验证，不注册猜测别名。基本 creation 元数据由 host 从实际步骤推导。查询轮次、次数与共享模型恢复预算分开记录；规划只能直接调用本轮已声明 READ，WRITE 仅进入 draft plan。常用上下文 READ 明确声明，其余契约按需加载。Skill prerequisite 与指导保留，重复工具/依赖验证交由正式 Registry。空合成复用 createText完整参数，不预加载无关修改工具；Scope/UUID/Transaction/最终验证均保持。失败导出保留 module/capability/task/field 和限长 expected/received。详见 AGENT_EXECUTION_PATH_AUDIT.md、AGENT_STABILIZATION_RESULT.md。

## Swayframe 1.0 Agent Core V2

执行基线 docs/baseline/AGENT_CORE_V2.txt。Legacy V1 冻结于99586fd；V2-0～V2-4 使用独立 src/agent-v2，只有 TaskRuntime 管理任务状态与对象引用。语义动作映射既有 Registry，逐批执行原 AgentTransaction；真实结果验证后仅输出待接受草稿，明确接受后一次 Commit/Undo。默认助手仍为 Legacy V1，V2仅独立工程；真实Provider未验收，不启动高级能力迁移。见 AGENT_V2_ARCHITECTURE.md、AGENT_V2_IMPLEMENTATION_REPORT.md、AGENT_V2_MIGRATION_PLAN.md。

## 1.0.1 / V2-5 Provider validation boundary

Existing TaskRuntime/Planner/Recovery/Command architecture remains. createProviderCoreV2 binds the existing AIProviderManager and Native transport using explicit responseMode and one attempt per call, with pinned route and normal token accounting. Developer flag #agent-v2-test exposes an assistant scoped, typed contribution. AgentV2Lab owns an empty nonpersisted EditorStore, never receives the user's store and never attaches a V1 executor. Preview uses existing AgentSnapshotRenderer; only explicit acceptance commits via AgentTransaction. UI state stays outside Scene. Ordinary runtime remains legacy-v1. Authorized 2026-10-12 live Smoke verifies five V2 tools tasks and one structured JSON-text task through the actual DeepSeek provider, Renderer and shared Transaction; all attempts and V1 permission-catalog rechecks retain a cumulative16-call ledger. Production Canary and replacement gates remain NOT READY pending independently repeated samples and real user Canary; no statistical superiority claim. No Skill/Forge/reference reconstruction migration.


1.0.2 / V2-6：沿用 TaskRuntime 唯一状态所有权，新增写前/写后证据护栏、确定性局部恢复、失败动作参数修复、预算预留和恢复可观测性。详细边界见 `docs/ARCHITECTURE.md` 与 `AGENT_V2_RECOVERY_ARCHITECTURE.md`。普通工程仍默认 V1，V2 隔离入口和正式 Canary 边界不变。

## 1.0.3 / Agent Core V2-7

AgentPanel now explicitly selects Legacy V1 (default) or Core V2 Beta in the same editor. CoreV2EditorController binds the existing TaskRuntime/Planner/ProviderBridge/Registry and current EditorStore CommandSystem. ConversationSession holds committed UUID metadata only; each turn reads authoritative current Scene properties and revalidates project/composition/type/lock/scope. No draft stepResult becomes cross-turn authority. Each turn uses one independent AgentTransaction and explicit acceptance. GUI changes and cancellation invalidate pending drafts; V1/V2 writes are mutually exclusive. Session/runtime/layout state stays outside Scene. Three minimal WRITE mappings bring the subset to13; dimensions reuse layer.replace, font/delete-keyframe reuse existing tools. Real App offline S1–S8, Renderer, disk reload and second-process continuation pass; paid V2-7 validation is pending and Canary remains NOT READY. See AGENT_V2_7_IMPLEMENTATION_RESULT.md.

1.0.3真实服务配置错误边界：兼容Provider只对已知model_not_found/invalid_model/model_not_supported编码判为模型配置错误，认证401/403优先，普通503仍按暂态服务规则处理。V2将明确配置错误转换为不可恢复PROVIDER_RESPONSE，不切换模型或反复重试；UI沿用既有助手状态及设置入口，保留输入，不回显原始服务正文。测试宿主沿用实际桌面main.ts与正常IPC，未新增执行系统或产品凭据读取通道。7次聊天配置拒绝、1次目录成功未证明连续模型可靠性，默认V1和Canary NOT READY不变。

1.0.3最终规划文档与范围同步：语义动作参数由原actionSchema定义一次，能力上下文只投影真实注册表名称/说明/权限/可用性，低层参数仍在Registry严格校验。格式示例通过同intentSchema验证，永不代替用户目标或执行。context.scope.allowCreate=false时，用同动作定义构造不含createShape/createText的传输契约，禁用对应创建能力、省略创建示例；主机范围/类型/UUID检查仍独立存在，未知或恶意返回不能取得更大权限。模型不直接写Scene，没有新的命令、执行路径或Scene/UI状态字段。最新单项实测通过，完整连续会话和公平对照未完成，默认V1、Canary NOT READY。
