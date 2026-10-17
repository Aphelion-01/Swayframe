# Agent stabilization result — Swayframe 0.10.1

本轮已修复有证据支持的规划声明不一致、能力元数据重复编写和预算诊断；保留正式 Command / Transaction / Scene / Renderer。没有功能扩张，没有修改无关 UI，没有新增 Registry、Controller 或兼容白名单。

1. **shape.rectangle 来源**：用户原始 Trace 未提供，历史保存证据未检索到。隔离输入在 submitPlan.creation.tasks.capabilityId 注入该字符串；首次正式拒绝在 creation-planner。不能证明最早哪份提示生成它。
2. **是否注册**：否。实际 Rectangle 工具能力 ID 为 createRectangle / createShape，正式 Command 为 layer.create。没有这个合法别名定义，不凭字符串注册。
3. **首次错误引用**：隔离复现是提交计划元数据；旧正式 Skill / Registry 没有该引用。真实历史模型触发源 NOT PROVEN。
4. **Planner 越权/超限原因**：真实 DeepSeek #5 请求已注册 READ getCanvasInfo，却缺少本轮声明，reads仅1/12，属于目录/声明不一致。旧错误将这类情况和超限混为一谈。新错误和 Trace 区分每类原因，查询轮次不再与纠错轮次混用。
5. **Skill 新不一致**：未发现内置 Skill 声明 shape.rectangle；存在重复工具/依赖校验、上下文重复和空合成无关字体修改契约，已削减。Skill没有新增写权限。
6. **最稳定配置**：固定输入下 A/B 最短、无外部模型依赖；C/D四配置 Scene 和 PNG相同。真实组合任务 C/D均成功，D一次提交、C一次参数patch；样本1不能推长期优劣。
7. **保留**：原生 Registry、引用解析、依赖保护、共享 RecoveryController、AgentTransaction、CommandSystem、Renderer和用户审批。
8. **移除/减少**：Skill中平行工具/依赖校验；基本计划由模型重复定义 creation 元数据；重复能力字段及无关预加载契约；不删有消费者的旧bridge。
9. **代码修复**：creation-planner真实executionTools/availability与严格映射；ToolContext常用READ/按需schema；Orchestrator分类诊断/独立查询计数/Trace；Recovery只允许精确失败任务能力候选patch；开发诊断保留限长expected/received；显式Providerunsupported分类。源码和回归见另外四报告。
10. **剩余边界**：原始 shape.rectangle prompt来源未知；仍不能保证LLM从不生成非法计划， host将其拒绝或有限修复；Fill测试有命名附加差异；复杂Vision重建和Windows实机安装未验证；无签名证书。不是“所有Agent问题永久解决”。

真实基础任务功能验收及组合任务完成；完整预算 12 次 / 168794 输入 / 5154 输出 tokens，0图片。四配置真实渲染、一次提交、Undo/Redo、Save/Reload通过。最终门禁与安装包完整性在 outputs/agent-stabilization。Mac arm64 DMG / Windows x64 NSIS 位于 release。

审查入口：AGENT_EXECUTION_PATH_AUDIT.md；AGENT_CAPABILITY_CONSISTENCY_REPORT.md；AGENT_PLANNING_BUDGET_REPORT.md；AGENT_STABILIZATION_TEST_REPORT.md。账本/原始失败/恢复/工程/PNG全部保留，不将mock标记为LIVE。

最终门禁：158个测试文件、687项测试通过；typecheck/lint/desktop build通过。Mac成品启动和DMG校验通过；Windows x64安装包已生成且payload为PE32+ x86-64，未做Windows实机运行。两包未签名。具体校验与SHA256见 outputs/agent-stabilization/RELEASE_MANIFEST.json。原工作区542个受保护文件、HEAD、branch、index与既有保护清单一致，0.10.0工作区干净。
