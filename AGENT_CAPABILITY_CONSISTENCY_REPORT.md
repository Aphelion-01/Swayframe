# Capability consistency — 0.10.1

权威可用能力入口继续使用已有 `creationCapabilities(registry, packages, providers)` / `registerCreationTools(...).capabilities()`。Planner、Skill、ToolContext 和执行校验引用同一个正式工具 Registry，不创建第二目录。UI Feature ID 是入口标识，不自动成为可执行能力。Graph/Visual Registry 是各自类型定义来源，汇总为同一个可发现视图。

| 实际能力 ID | Tool | 编译 / Command | 来源 |
| --- | --- | --- | --- |
| createRectangle | createRectangle | created(rectangle) → layer.create | write-tools.ts:233、creation-planner.ts:139 |
| createShape | createShape | 按已注册 kind 组合正式 createRectangle 等 → layer.create | semantic-actions.ts:48 |
| createText | createText | created(text) → layer.create | write-tools.ts:246 |
| setFill | setFill | 原生 Appearance / Property Commands | write-tools.ts:592 |
| radialGradient | createNode / setNodeParameter；Fill 使用 setFill / setGradientFill | 原生 Graph / 原生 Fill Commands | VisualCapabilityDefinition 与 creation-planner.ts:75 |
| shape.rectangle | **不存在** | **没有映射** | baseline before.json / 正式目录 |

Capability ID、Tool Name、Command type 允许不同；现在 catalogue 明确带 `executionTools`，工具条目的 parameters / outputSchema / targetConstraints 从正式 Registry 派生。显式任务 capabilityId 必须存在、available，且关联的步骤包含该能力的正式执行 Tool，参数和对象语义继续由原生 schema / compiler 校验。没有执行器的 motion preset 不再被标记 available；provider 信息仍是 planning-only，不能冒充生成节点。精确程序包 version/hash 仍从正式 discovery / 工程嵌入包获取，摘要精简没有改变运行信任协议。

Planner 的 WRITE 概览使用真实 Tool Name 作为 capabilityId；READ 以本轮实际 function 声明为准。常用 getCanvasInfo/getCurrentTime/inspectSelection 与既有 READ 一同声明。其余契约仍通过已有 inspectToolContract 按需加载，下轮声明和 schema 从同一实例刷新，不将目录查询变成写权限。

对 shape.rectangle 的决定：不注册。它并非现有合法语义能力，仅凭名称像矩形不能推断为真实能力。模型省略基本 creation 元数据时，host 从真实步骤推导 createRectangle；若主动提交非法 ID，预检仍拒绝。允许的恢复仅修改实际失败任务的能力元数据为该任务真实 step Tool 的目录候选，不改操作、参数、对象或权限。`applyPlanRepair` 同时拒绝其他任务、其他能力替换。

Skill requiredCapabilities / actions 当前均使用已有 Tool 名。没有证据显示内置 Skill 曾声明 shape.rectangle。它重复查询工具/依赖的预检已移除；正式 Registry 的未知工具和依赖保护仍开启。旧 SkillManager allowedTools 继续是授权过滤，原生 Skill 指导不能扩权。

证据：tests/agent-stabilization.test.ts:204（Rectangle 映射）、:220（未知能力）、:237（不同 ID / Tool）、:269（过期 Skill）、:370/:614（有限精确能力 patch）、tests/native-skill-runtime.test.ts（正式 Registry 拒绝未知工具）。原用户 shape.rectangle 历史提示源仍 NOT PROVEN。
