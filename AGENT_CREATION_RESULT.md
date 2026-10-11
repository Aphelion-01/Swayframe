# Swayframe V0.4 Agent-Guided Creation Result

交付版本 0.9.20；执行基线 docs/baseline/V04_AGENT_CREATION.txt。

## Implemented

Phase A/B 的本地执行链已落地：任务/依赖/策略契约、真实能力发现、Graph Inspection、原生合成/Graph构建、基础 DAG 自动布局、节点参数 AI、上游分支 AI、真实数据 Scope Validator、实际 Change Proposal、接受前 Renderer 草稿预览、接受/拒绝、单一 Transaction、Undo/Redo 和保存重开。Node Inspector 入口独立拥有 typed node.ai 绑定，切换离开 Graph 后仍能使用。

## Reused Existing Systems

AgentOrchestrator / AgentPlan / AgentToolRegistry、CommandSystem / AgentTransaction、VisualCapabilityRegistry / GraphNodeRegistry、原生 Graph/Property/Animation Engine、SnapshotRenderer / CanvasGraphBackend、已验证 Declarative Runtime、既有 Effect Forge / User Library。没有第二套 Graph、渲染器、动画引擎或远程插件框架。

## Prompt-to-Graph / Composition Results

确定性真实工具测试创建原生径向渐变、Glow、分支纹理、merge、可编辑 Text 与原生动画，结构可保存/编辑。图布局保证基础不重叠，非最优布线。流动纹理使用明确标注的 organicTexture 近似，不宣称实现精确噪声算法。真实 Provider deepseek-flash 已完成原生渐变＋背景Glow＋可编辑Text/Position/Opacity动画创作，以及背景分支参数修改的数据闭环；输出已在浏览器实际 Renderer 打开。开放任务的视觉质量仍需人工调整，不保证任意提示词都能正确完成。

## Node-Level / Branch-Level AI Results

Node入口默认 PARAMETER_ONLY，用户才能选择扩大至当前节点或实际上游分支。Blur20→35不重复创建。背景改紫与降低Glow只修改既有参数，保留Text内容、关键帧/Spring、Camera、纹理、无关Graph/IDs/边界连接。Proposal 展示受影响/保留内容和参数前后值。预览正式Scene不变，接受单次Undo，过期/越界草稿拒绝提交。

## Scope Protection Results

每个 sandbox 写入后及提交前检查真实 Project；模型返回内容不能扩大权限。一次越界关闭整个事务。下游视觉依赖与数据修改许可严格分开。FULL_COMPOSITION 限定当前合成；跨合成打开/创建及工程资产修改不可用。结构删除只能先在草稿显示，再明确接受正式提交。草稿、库、范围和 UI不进入Scene，正式效果库不自动保存。

## Test Results

535 tests / 135 files；lint / typecheck / build / desktop build PASS。4种窗口布局检查PASS，独立macOS测试包已生成；原生自动操作接口超时，独立桌面窗口交互验收仍未通过。详见 AGENT_CREATION_TEST_REPORT.md、outputs/agent-creation/ 和 FEATURE_PLACEMENT_REVIEW.md。

## PARTIAL / NOT IMPLEMENTED

- 真实 Provider：PASS（本轮限定案例的数据闭环），单节点修改与完整创作/背景局部修改均已通过；不代表任意自然语言均成功。历史失败记录保留在输出目录。
- 精确流动噪声与新特殊流体生成：PARTIAL，仅复用已验证近似纹理与既有Forge后备机制。
- Node Groups、外部图像/视频 Generative Nodes 与更深 Forge 集成：NOT IMPLEMENTED（Phase C条件项）。本轮优先收束真实规划可靠性，原生窗口验收仍有工具边界；没有伪按钮。
- 任务选择优先级由模型语义判断＋代码结构保护实现，不承诺任意自然语言均产生最优方案。未实现供应商费用报价/购买预算，显示实际 Token 与服务计费说明。

独立应用 release/agent-creation-v04/mac-arm64/Swayframe.app 不覆盖 /Applications/Swayframe.app；本轮真实Provider测试仅修改临时合成，不写用户工程或效果库。新独立验收包为 release/agent-creation-v04-followup/mac-arm64/Swayframe Agent QA.app。


## 0.9.20 可靠性修订

限制Graph规划上下文并优先目标节点；修复多关键词能力发现；补充色标五元组、像素坐标、自动插入和已有edgeId契约。规划末轮收束为submitPlan，残缺JSON最多重新生成一次，V0.4结构校验失败最多纠正一次，共用四轮预算；网络错误不重试，不对失败数据执行操作。真实验收脚本按应用planning/general/default路由选择供应商，保存重开使用结构相等而非JSON字段排序比较。
