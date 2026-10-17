# Swayframe 1.0.0 Agent Core V2 实施报告

## 1. LEGACY BASELINE

基线 0.10.1 / `99586fd`。独立分支 `codex/agent-core-v2-1.0`，工作树 `Swayframe_Repairs/1.0`。原工作区 542 个受保护文件、HEAD、branch、Git index 均与保护记录一致；0.10.1 工作树干净。比较156个旧 Agent、AI、核心、Renderer及 native-agent-controller 文件，零修改。证据 `outputs/agent-v2/baseline.json`。

未假定历史 bug 全都仍存在。现有 V1 的普通四组任务在相同固定响应对照中通过。本轮在独立新增模块执行 parallel replacement，不继续给旧 Orchestrator/Skill/Recovery 增功能。

## 2. V2 ARCHITECTURE

单一 TaskRuntime 管理步骤、目标、真实对象引用、草稿版本、恢复、预算和接受。ProviderBridge/AgentPlanner 只输出 Task Intent 或局部 Proposal；EditorAdapter 复用正式 Registry/AgentTransaction/CommandSystem。详细约束见 AGENT_V2_ARCHITECTURE.md。

## 3. IMPLEMENTED

V2-0～V2-4：冻结、隔离、保留 V1 默认；严格语义动作 Schema；工具/结构化 JSON 意图响应；真实动态 Tool 契约投影；逐步执行/状态观察；Existing/Selected/Step Result Layer 和 Keyframe 绑定；Rectangle/Ellipse/Text、Position/Opacity、纯色/线性/径向 Fill、Gaussian Blur、关键帧及插值修改；独立后条件、Graph/动画/命令验证、真实 Renderer；变更 diff、受限恢复、取消、待接受草稿、一次 Commit/Undo。

执行状态 PENDING→READY→RUNNING→SUCCEEDED / FAILED / CANCELLED，任务验证后仍等待宿主明确接受。只有成功创建结果才能成为后续真实 Layer ID。不通过猜 UUID/名称/别名恢复。

## 4. REUSED

Scene Model、Property、Animation Engine、Effect/Compositing Graph、Canvas2D Renderer、Assets、Project IO、Shared CommandSystem、Transaction、Undo/Redo及 AgentTransaction 均复用；没有新的 Scene/Tool/Capability Registry。凭证、HTTP、Provider Configuration、取消、现有用量传输协议沿用。

## 5. TESTS

最终 typecheck、lint、159个测试文件/735项测试、desktop:build 均通过。新增48项 V2 测试含真实工具 Schema、失败动作模型修复、对象/范围/锁定/版本/Undo/取消/预算/重放/渲染/提案边界。最终日志 `outputs/agent-v2/quality/v2-4-*`。

五个 Benchmark，每条路径20次每组，总计200任务，真实原生 V1 与新 V2 Runtime，实际 Canvas2D PNG、保存重载、Undo/Redo和原有无关图层保护。前四组 V1/V2首轮 PNG 哈希完全相同，80对最终 Scene语义相同。B5 V1未提交，没有把失败结果伪造为成功像素。

初始开发中出现测试端 Renderer 调用签名、V1局部修复回复格式、测试锁定命令遗漏 compositionId 等错误；修复后重新测试。旧报告与所有失败记录保留，不用于宣传模型成功率。

## 6. RELIABILITY

最终固定响应离线任务：V1 80/100、V2 100/100；V2每项20/20。V1的20个失败均为B5故障注入恢复拒绝。这是确定性 Runtime 回归，不是100次独立真实 LLM 样本；当前真实 Provider 任务成功率未知，未证明95%目标。

## 7. RECOVERY

B5两边均先成功创建矩形，在 Add Gaussian Blur 命令写入前注入一次可恢复参数错误。V1拒绝原参数重试（“模型重复提交相同的无效参数”），安全丢弃。V2只重试失败动作，已完成矩形只执行一次，最终一个新增矩形、一个 Blur、一笔 commit。

另外单元测试使用实际 setOpacity 工具 Schema 拒绝 Vec2，再通过 ProviderBridge/Planner仅修正失败动作到数值.5，记录两次 fixture请求及其 fixture usage；不是仅靠故障 Mock。重复错误只有限尝试，不允许更换目标/属性路径或重放成功创建。没有 checkpoint重建；无法可信继续则丢弃，不猜新对象。

## 8. SAFETY

每个最终对照工程均含一个受保护原有图层，完整属性保持一致；任何路径意外工程修改0。V2接受前正式工程零写入；成功任务一笔Commit/Undo，保存重载/Redo正确；V1故障安全丢弃。验证新的正式基线、越界、锁定、错误接受令牌、取消后的迟到响应和重复run，均不会提交非法草稿。所有图像为生成的独立测试工程，无用户素材外发。

## 9. PROVIDERS

本轮外部 API请求0。**LIVE NOT VERIFIED**。旧授权12次DeepSeek请求已在0.10.1用完，未新增付费调用。固定响应模型为同一个 `fixed-v1-v2` fixture标签，不是真实 Provider。

桥接目前复用 openai-compatible / mock配置；Claude原生协议未实现。tools/structured-plan规范化离线测试通过，但各实际端点 Function Calling、Structured Output、Vision和上下文限额均未认证。端点明确报告unsupported_tools时提供专门错误，不能用别的网络失败猜其能力。

## 10. LIMITATIONS

没有真实模型 Smoke/95%独立样本统计。V2未接入高级 Graph Commands、Skill、Reference Analysis、Effect Forge。没有正式用户界面的V2切换/连续会话/流式进度新体验，也未扩展文本/3D/所有效果参数。V2 ESM模块已经编入安装包，可由隔离宿主使用；普通助手仍是V1。

安装包未签名；Mac成品实际启动验证，Windows仅交叉生成，未实机安装运行。不能把新版本号或安装包理解为V2已经默认替代V1。

## 11. NEXT STAGE

先按 AGENT_V2_MIGRATION_PLAN.md 完成经授权的小规模真实 Provider 对照；随后进行足够独立样本验收、受限 Canary，再按领域接入高级能力。模型可靠性与视觉复刻质量分别测量。

## 12. MIGRATION STATUS

**NOT READY**。V2-0～V2-4离线核心闭环已完成并可审查；真实Provider门禁未通过前，保留 V1 默认与回退。安装与构建明细/哈希见 outputs/agent-v2/RELEASE_MANIFEST.json。

B5 保留正式 Gaussian Blur 默认 radius=0，验收其真实效果实例、恢复不重复与事务；该 PNG 不作为非零模糊质量证明。V2 本轮未开放效果半径编辑动作，参数可由现有 GUI 修改。
