# Agent Planner V0.4

基线：docs/baseline/V04_AGENT_CREATION.txt。版本 0.9.19。扩展现有 AgentPlan / AgentOrchestrator，不建立第二套 Agent。

## 输入与任务模型

用户需求与实际 Project Context 输入同一个规划器。creation 包含 intent、tasks、warnings；task 包含 id、description、executionDomain、strategy、capabilityId、stepIds、dependencies。任务依赖必须先完成，实际执行步骤顺序必须一致，每一步恰好属于一个任务。旧计划由适配器补齐元数据，只用于兼容，不声称完成模型语义分解。

能力来自 VisualCapabilityRegistry、GraphNodeRegistry、真实工具注册表、内置 Motion Presets、已验证程序包和启用的 Provider。包含真实参数、端口、动画/执行/费用/兼容性信息；READ 工具 discoverCapabilities 支持关键词查询。Provider 目前只提供规划/分析，不能冒充图像或视频生成节点。工具实现不随发现结果暴露，参数仍经 Zod 校验。

## 决策与保护

优先 modify-existing → reuse → compose → generate → forge。这是模型决策指导，不能宣称对所有自然语言都能判断最优方案。代码拒绝 modify-existing 任务创建/删除对象、reuse 任务创建 Forge 草稿、未知能力、循环依赖、重复步骤以及未注册工具。

参数请求优先 setNodeParameter；原生径向渐变优先 radialGradient；原生 Text/Keyframe/插值保留编辑结构。缺少精确流动噪声能力时只能明确说明有机正弦纹理近似，不得默称真实流体噪声。无法实现的生成任务必须说明缺口。

## 生命周期

run 只规划；原生运行时统一要求预览与接受。preview 在 AgentTransaction sandbox 执行，校验 scope、Graph 编译并由原有 SnapshotRenderer 渲染；启用视觉验证时先完成验证/修正，再计算最终实际 diff。接受提交一次 Transaction；拒绝、停止、模式/Skill/参考切换丢弃草稿。正式工程发生变化，旧预览不能接受。模型 Token 用量单独显示，不将本地预览说成免费模型调用。

任务/Proposal/Scope/UI/信任/库状态不存入 Scene。不执行任意脚本，不允许 Agent 修改核心源代码，不自动保存正式效果库。


0.9.20 续轮：真实 deepseek-flash 单节点修改及原生创作/背景分支修改的数据闭环已通过；具体边界见 AGENT_CREATION_TEST_REPORT.md。Graph 摘要限制16,000字符，细节按需检查；正式 Scope 验证仍读取完整 Project。规划错误最多有限重新生成，拒绝内容不执行、不放宽权限。
