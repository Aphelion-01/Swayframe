# Agent Core V2-7 / 1.0.3 架构变化

基线为 1.0.2 / 469470d，独立分支 codex/agent-v2-continuous-1.0.3。原用户工作区与历史验收证据受哈希保护，不清理未提交修改。

TaskRuntime 仍是唯一执行状态所有者。AgentPlanner/ProviderBridge/Recovery/Registry 复用；CoreV2EditorController 只负责当前 EditorStore 的入口、UI订阅、Session 引用及脱敏完成轮次诊断。每轮创建独立 AgentTransaction 草稿，Preview 在真实 Renderer 完成后显示；Accept 唯一 Commit。GUI 和 Agent 使用同一 CommandSystem，Intelligence 只返回 Proposal。

ConversationSession 保存正式提交后的 layer UUID、project/composition、type/shapeKind、明确 title/subtitle角色、turn/transaction ID，绝不复制属性作为权威状态。每轮从当前 Scene 求值；显式 ID、选择、当前唯一类型、已提交创建顺序和最近 GUI 修改构成有限引用解析，不按相似图层名猜测目标。

createEditorCoreV2 要求 betaOptIn=true；旧 createIsolatedCoreV2 复用它。默认选择仍是 legacy-v1；V1 在 V2 选择期间被入口和事务开始双重保护。无第二 Runtime、Planner、Command System 或远程框架。

最小 WRITE 子集从10扩至13：尺寸映射 setLayerDimensions →既有 layer.replace；字体映射已有 setFont；指定关键帧删除映射已有 deleteKeyframe。新工具不放宽 UUID、Scope 或字段验证。尺寸、字体及关键帧删除均有真实结果后置验证。

源文件：src/agent-v2/session.ts、index.ts、provider-session.ts、actions.ts、editor-adapter.ts、verification.ts、recovery.ts；src/ui/core-v2-controller.ts、agent-runtime-selection.ts、AgentPanel.tsx、AgentV2EditorPanel.tsx、native-agent-controller.ts；src/agent/write-tools.ts。

编辑器工厂新增可选time端口，沿用AgentTransaction已有时间上下文；后置验证和Renderer使用同一时间，没有另建时间/任务状态。显式3D/摄像机/模型目标在请求前停止。
