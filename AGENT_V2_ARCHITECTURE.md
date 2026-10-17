# Swayframe 1.0.0 — Agent Core V2

## 范围与基线

冻结 Legacy V1 于 `99586fd`（0.10.1），独立分支 `codex/agent-core-v2-1.0`。原工作区未提交文件保留。执行基线为 `docs/baseline/AGENT_CORE_V2.txt`。本轮范围 V2-0～V2-4；不接入高级 Graph 编辑、Skill、Reference Analysis 或 Effect Forge。

产品版本为 1.0.0，工程 schema 仍为 0.7.0。版本号不代表已经证明 LLM 95% 成功率。普通助手默认 Legacy V1。V2 通过 `createIsolatedCoreV2` 在独立工程使用，不接入当前普通助手的写入端。

## 单向依赖

`ProviderBridge → AgentPlanner → TaskRuntime → EditorAdapter → AgentTransaction → AgentToolRegistry → CommandSystem`。

`actions.ts` 是少量语义意图 Schema，不注册能力或命令。`planner.ts` 只返回意图/失败动作修复 Proposal；不持有 Scene、对象绑定或执行状态。`runtime.ts` 唯一持有 Task ID、阶段、动作状态、真实引用、完成/待办集合、错误、恢复次数、预算、用量、草稿版本与接受令牌。`recovery.ts` 是无状态策略与参数修复验证。`verification.ts` 独立检查动作的实际 Scene 后条件。

Adapter 持有原有 AgentTransaction，不增加第二套 Scene/Command/效果执行器。事务内部 bindings 仅沿用命令执行证据；V2 的对象解析以 TaskRuntime.references 为权威，不读取 V1 Planner/Recovery 的状态。

## 语义动作与真实映射

| 意图 | 实际工具 | 实际操作 |
|---|---|---|
| createShape / rectangle、ellipse | createRectangle / createEllipse | layer.create |
| createText | createText | layer.create，原生文本属性 |
| setProperty / position、opacity | setPosition / setOpacity | 原 animationEdit / Property 命令 |
| setFill | setFill | 原生 Fill / radialGradient 正式参数定义 |
| addEffect / gaussianBlur | addEffect | 共享 Graph 的正式 createNode 编译 |
| addKeyframe | addKeyframe | keyframe.add |
| modifyKeyframe / interpolation | setInterpolation | keyframe.update |

V2 第一阶段只支持上表。Modify Keyframe 本轮只修改已有关键帧插值，不声称支持全部路径/时间/空间切线编辑。Set Property 本轮只开放 position、opacity。实际参数、默认值、权限、Graph 与 Command 输出校验继续来自现有 AgentToolRegistry/编译器；Fill 参数直接从 radialGradientDefinition 派生。`capabilities()` 是上述现有工具 contract 的投影，未创建新的能力数据库。

## 执行与对象

高层计划可包含全部语义动作；执行时每个确定性动作是一小批共享命令。完成一批后核查 Scene、绑定实际返回身份，再推进后续批次；普通属性修改不会单独请求模型。默认预算为 100 动作、2 恢复、3 次模型请求，上限不可增加。

只允许 Existing Layer、唯一 Selected Layer、成功创建动作 Result Layer。关键帧引用可为真实现有 ID 或 Add Keyframe 的实际结果。模型不得提供创建用 UUID，也不得把 Task/Graph/Keyframe ID 当 Layer ID。当前合成、授权已有图层、创建权限及锁定状态在解析和事务校验时检查。

计划 ID 唯一；根据显式依赖和结果引用稳定排序，循环/缺失依赖终止。排序不猜测对象名。不执行任意字符串工具、任意脚本或业务参数 Record。

## 草稿、验证、授权

正式工程始终通过原 AgentTransaction 的隔离 CommandSystem 草稿处理。每一步先过正式工具 Schema/编译器，再过原 Command/Scene 校验与 V2 语义后条件。最终复用 verifyExecutionState 检查命令归约、Graph 与动画；按任务需要调用现有 AgentSnapshotRenderer，经 Adapter 注入真实 PreviewRenderer。未提供 Renderer 明确 NOT_VERIFIED；requireRender 任务不得继续到接受阶段。

完成验证只进入 AWAITING_ACCEPTANCE，返回 Proposed Changes 与独立 proposalId。模型、Planner、Repair 不得到 accept/commit 端口。宿主明确接受当前 proposalId 后，检查同一正式 base、范围、验证并一次 commit。一次 Undo 撤销全部 Agent 修改。正式工程中途变更则拒绝旧草稿。

## 恢复与取消

完成步骤不可再运行；同一任务不可 run 第二次。Schema 默认值及引用绑定由现有契约/Runtime 确定性完成。可恢复参数错误只请求失败动作及紧凑结构化错误；候选不得更换动作 ID、类型、目标、依赖、属性路径、文本内容或关键帧对象。相同动作/错误/字段指纹重复即停止，仍受全局恢复/模型预算限制。权限、缺失能力、过期 base 与未知状态不通过字符串猜测恢复。

无法可信继续的草稿直接丢弃，本轮未实现 checkpoint 重建，不机械复用旧 UUID。Cancel 中断 Planner/恢复/渲染续跑，丢弃草稿，不提交成功步骤。保留已成功步骤的证据用于诊断，不把取消标为完成。

## Provider 与构建

Provider Bridge 复用现有 ChatRequest/ChatResponse、HTTP、Streaming 传输、凭证与取消端口。可以选择 tools 或显式 structured-plan 原始 JSON 意图模式；不会在能力未知时假装兼容，也不自动切换协议。当前 ProviderConfig 原生只承认 openai-compatible / mock；不声称已实现 Claude 原生协议。工具调用、结构化输出、上下文上限仍标为 unknown；Vision 仅配置声明，未真实认证。

Vite 多入口构建保留 `agentCoreV2` ESM 导出，并与应用共享编译后的核心依赖；安装包包含 V2 模块，但普通助手不自动加载它。诊断执行器不会与普通工程绑定。运行对照通过 `work/agent-v2` 的隔离 Electron 页面，固定响应，不读取账号，不访问网络。

## 扩展限制

状态只能在 TaskRuntime；命令只经 Adapter→共享事务；引用只由 Runtime；Provider 无 Scene 编辑逻辑；Recovery 无 Scene；Skill 无执行器；Planner 不绕过 Validator；成功的创建动作不重放；未验证不完成。正式替换前必须补真实 Provider 和独立重复样本，之后才按领域接入高级能力。
