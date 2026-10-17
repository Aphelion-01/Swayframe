# Node / Branch AI V0.4

## 入口

ASSISTANT 域：node.ai 的主入口是节点 Inspector 的参数 Section，默认 PARAMETER_ONLY；branch.ai 与 graph.ai 通过既有节点上下文菜单进入。命令注册、贡献点、全局不可用状态、Feature Inventory / Location Matrix 共用现有系统，不添加常驻全局按钮。

同一个 CreationPrompt 与 NativeAgent 服务节点/分支/合成。范围下拉由用户明确选择，展示实际可修改节点名字；Agent 的返回值没有授权扩围字段。不能可靠定位时返回候选或失败，需用户选中目标，不猜测全局改写。

## 授权范围

- PARAMETER_ONLY：限定节点的现有参数 Property 值/关键帧；节点 ID、参数 ID、连接、位置、开关、名称固定。
- SELECTED_NODE：仅选中节点的参数、名字、位置、启用状态；不替换节点 ID。
- SELECTED_BRANCH：从选中末端沿实际输入连接解析上游处理节点，排除受保护 Source/Output；允许分支内部结构变化，但跨边界连接及所有外部节点完全不变。
- FULL_COMPOSITION：仅当前合成；不能打开/新建别的合成或改变工程资产及无关合成。

渲染依赖可以影响最终画面，但不授予修改下游数据的权限。每个 sandbox 命令后及 commit 前比较真实 Project 快照；任何越界直接关闭事务，不能继续修补后提交。模型提示词不是权限边界。

## 提案与接受

creationDiff 从 base/draft 产生对象、节点、连接、参数前后值/关键帧和保持不变内容。UI 显示任务策略、受影响/保留名称、局部参数 diff、模型用量与限制说明。预览不提交 Scene；拒绝不改变工程；接受使用单一 AgentTransaction，可一次 Undo，保存重新加载保留 Graph/Property/内嵌包。

结构删除也只在 sandbox 中预览，正式删除必须点击接受；不再出现无法预览、又必须预览才能接受的死路。过期工程拒绝提交。失败保留输入与错误信息。


0.9.20 续轮：真实 deepseek-flash 单节点修改及原生创作/背景分支修改的数据闭环已通过；具体边界见 AGENT_CREATION_TEST_REPORT.md。Graph 摘要限制16,000字符，细节按需检查；正式 Scope 验证仍读取完整 Project。规划错误最多有限重新生成，拒绝内容不执行、不放宽权限。
