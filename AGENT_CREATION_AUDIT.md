# V0.4 Agent Creation 审计

2026-10-10，基线：docs/baseline/V04_AGENT_CREATION.txt。

| 系统 | 状态 | 可复用证据 / 缺口 |
|---|---|---|
| Agent Runtime / Tool Registry | Implemented / Reusable | Orchestrator 的只读规划与工具 Schema；缺少创作任务依赖及显式局部权限 |
| Command / AgentTransaction | Implemented / Reusable | sandbox 预验证、单笔 commit、并发修改拒绝、Undo/Redo |
| Scene / Property / Timeline / Motion | Implemented / Reusable | 原生 Text、图层命令、动画与缓动；不需要节点版 Timeline |
| Graph / Compiler / Renderer | Implemented / Reusable | 真实 typed ports、环检测、原生处理图和可序列化实例 |
| Visual / Effect / Node registries | Implemented / Partial | 各域真实注册表；缺少 Agent 汇总发现入口 |
| Effect Forge | Implemented / Reusable | declarative-pixel-v1、验证/编译/像素预览/内嵌精确包；不重做 |
| Graph inspection | Partial | inspectGraph 已有；节点/分支/下游依赖缺少专用读取 |
| Creation Planner | Missing | 现有步骤有 Schema，但没有带执行域、策略、依赖的任务模型 |
| Node / Branch AI | Missing | 缺少节点参数默认权限、branch mutation guard 和修改提案 |
| Proposal preview | Partial | 执行前计划确认已有，草稿在执行中存在；缺少接受前的可视化及参数 diff |
| Persistence | Implemented / Reusable | Graph/Property/内嵌程序包保存；计划/信任/UI不进 Scene |
| Node Group / external image/video generation nodes | Not Implemented | 本轮 C 条件项，不增加伪入口 |
| Duplicated | No new subsystem required | 复用同一 Agent、Graph、Renderer、Command；统一发现只是注册表适配器 |

风险：只在提示词声明 scope 不能保护工程；必须在每个 sandbox 写入和 commit 前比较真实数据。分支下游渲染变化不代表下游修改许可。真实模型需单独验证，固定响应测试不证明开放任务能力。

本表记录编码前审计状态。实施后状态、部分实现与真实 Provider 验证边界见 AGENT_CREATION_RESULT.md，不用本表的初始 Missing 判定当前版本。


0.9.20 续轮：真实 deepseek-flash 单节点修改及原生创作/背景分支修改的数据闭环已通过；具体边界见 AGENT_CREATION_TEST_REPORT.md。Graph 摘要限制16,000字符，细节按需检查；正式 Scope 验证仍读取完整 Project。规划错误最多有限重新生成，拒绝内容不执行、不放宽权限。
