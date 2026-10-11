# Agent Reliability Fixes — 0.9.23

- src/agent/write-tools.ts：createText 的同一 Zod 契约新增 fontSize/fontFamily/color/alignment，映射真实 Text Layer 与动画属性，不引入平行文字模型。
- src/agent/tool-registry.ts：模型声明与运行时校验共用同一契约；返回结构化字段错误；compile 错误有工具名称；verifyResults 检查创建/替换图层、文字内容/字体和 property.setBase 的持久结果。
- src/agent/transaction.ts：postflight 在沙箱执行之后、正式提交之前，失败丢弃事务。图层/属性检查不等于视觉相似性检查。
- src/agent/orchestrator.ts：所有原生计划可在预检失败后有限修正，不再依赖 creationContext 才能恢复；相同工具参数的无效计划停止重试；读取错误进入模型 Tool Result 与 failed 活动。视觉修正无实际数据变化时停止，保留每轮实际画面/差异。
- src/agent/reference-analysis.ts、intelligence.ts：整体参考任务先读取授权像素，返回结构化观察/几何/颜色/效果/文字/依赖/原生映射与置信度；缺像素明确失败。Intelligence 仅输出 Proposal。
- src/ui/native-agent-controller.ts、src/agent/vision.ts：视觉检查同时发送已授权参考帧和真实共享 Renderer 帧，标记图片顺序，比较八类差异；保留原范围与删除保护。
- src/ui/AgentPanel.tsx：失败操作记录自动展开，错误字段可读；视觉检查/修正单独列出每轮画面。

没有新增平行 Scene/Renderer/Graph，没有远程插件或新效果算法；无新增永久工具栏按钮。

## 0.9.24 真实调用发现的问题

- 专业建议错误反馈包含字段路径和校验原因，模型不再只收到“格式无效”。
- 专业分析对不完整/无效 JSON 响应有界恢复一次，不重试认证错误。
- 视觉修正预检包含真实能力、工具参数、对象引用及执行范围；无效修正反馈原模型纠正一次，未通过的建议不执行。
- 局部视觉修改提示使用精确注册工具，省略不必要的 creation 元数据；依然保留最终预检和 Transaction。
- 查询预算与计划纠错预算分开：最多3轮查询，后续仅submitPlan；最多2次预检纠错。相同无效计划仍停止，读取预算耗尽不会使首次失败失去修正机会。
- 单轮模型批量提出超过查询总次数时，超额调用不执行，返回明确 budget 错误并保留已完成结果；下一次只允许submitPlan。未知/越权工具仍直接拒绝。
- 无效计划去重同时比较实际步骤和任务能力/执行域/策略/依赖映射，忽略表面ID。修改能力元数据的方案仍有机会纠错，不会误判为同一无效计划。

## 0.9.26 修复
- createPath 明确中心原点、绝对手柄和直线顶点重复编码，禁止将手柄零误当偏移零。
- 扩展现有 setFill 适配原生 none/linear/radial 填充与注册径向参数，保持透视路径 alpha。复用 radialGradientDefinition / parameterError / Property / Command / renderer，没有增加算法或新工具名称。
- Planner 区分原生路径填充与独立矩形生成节点，明确 detached / Output 语义及参考像素到合成坐标缩放。
- Postflight 检查图层位置、尺寸、对齐、渐变模式、最终 Graph 节点/连接/参数及关键帧新增/修改/删除结果；参考分解拒绝循环依赖。
- 实际 Electron 离线适配器/renderer 已确认原生渐变有颜色变化且保留透视轮廓；这不属于真实模型的 Benchmark B。
