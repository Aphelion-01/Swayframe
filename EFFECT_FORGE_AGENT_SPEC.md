# AI Effect Forge Agent

策略固定为 Native → Compose → Programmable。规划提示要求先查能力；高斯模糊与径向渐变直接复用内置定义，不编造新实现。列表和搜索包含统一内置能力与用户库的指定版本。可生成新的声明式指令程序，不修改 Renderer 源码或执行任意 JS/Python/WGSL。

工具注册在 `effect-forge-tools.ts`，受 AgentToolRegistry 和原 Skill scope 管理：

- READ：effect_list、effect_search、effect_inspect；effect_createDraft、effect_updateDraft、effect_validate、effect_compile、effect_preview、effect_evaluate、effect_getDiagnostics、effect_discardDraft。
- WRITE：effect_applyDraft、effect_addToLayer、effect_addToGraph、effect_setParameter。只编译为共享 Command，由 AgentTransaction 执行。
- effect_saveReusable 只返回用户确认保存的建议与入口，不偷偷安装效果。用户可在草稿接受后，或工程中已应用效果的实例上，显式保存效果包。

READ 草稿工具只改临时 Forge Workspace，不修改 Scene。更新草稿会废弃旧预览和检查；applyDraft 检查当前哈希的预览与检查状态。应用提交内嵌精确包的 Graph/Layer 命令。只有用户已有的 Agent 事务接受机制才能提交正式工程；视觉 Observer 继续检查沙箱结果。

effect_preview 实际计算像素。隐私设置允许发送预览时，壳层把像素转换为图片，沿已有多模态消息路径提供给模型；关闭时仅提供尺寸和像素摘要，并明确禁止声称已识图确认。程序包通过受控运行时后允许会话内测试执行；持久信任和正式库保存与草稿阶段分开。

最低质量循环：检索 → 生成 → 验证 → 编译 → 预览 → 检查 → 事务沙箱 → Observer → 用户接受/拒绝。失败可更新草稿重试或丢弃。工具链已通过真实程序与事务测试；未以未配置的外部模型 API 测试冒充端到端模型生成验收。
