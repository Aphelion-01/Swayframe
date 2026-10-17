# V2_CAPABILITY_RESTRICTION_AUDIT

源码冻结：`066e172c23ecb7f24075d284eacc7b034f3dc36b`（父版本 `3c787b2`），分支 `codex/agent-v2-capability-unlock`，产品版本 `1.0.3`。

结论：确有不必要的产品限制，但不存在“所有创建都需要 Selection”这一统一根因。以下旧行为按父版本源码核对；修改均保留共享 Command/Transaction、正式工程版本及锁定校验。

| 调查点 | 源码 / 函数 | 原行为、原因、分类与处理 |
|---|---|---|
| Selection 前置 | `src/agent-v2/session.ts:ConversationSession.resolveRequest` | 已支持识别出的无选中创建、唯一文字；修改无候选则拒绝。后者是安全保护，不删除；修正“只/仅创建”漏识别，扩展原生类别、名称与明确UUID |
| selectedLayerId | `src/ui/core-v2-controller.ts:run`、`editor-adapter.ts:assertTarget` | V2不依赖单个selectedLayerId；Selection是引用来源。保留对编辑目标及实际存在性的验证 |
| 工具白名单 | `editor-adapter.ts:coreExecutionTools`、`provider-session.ts:createProviderCoreV2` | 原13个WRITE；V1注册了更多工具。产品子集，扩展为44个原生工具（43 WRITE、1 DESTRUCTIVE草稿） |
| Schema | `actions.ts:actionSchema/executionTool` | 原位置/透明度/字体、位置/透明度关键帧、仅gaussianBlur。产品限制；增加scale/rotation、全部原生effectKinds和有限原生参数适配 |
| 动作数量 | `actions.ts:intentSchema`、`runtime.ts:TaskRuntime` | 原本最多100动作，不是每轮只能1步。保留100动作、20明确编辑目标、180秒、最多3模型请求/2恢复等有限预算 |
| 规划输出 | `planner.ts:AgentPlanner.plan` | 原2000输出token可能截断正常多步计划；改6000。repair仍2000，总预算不扩大为无限循环 |
| 规划深度 | `runtime.ts:planAndRun/model` | 3模型请求是含恢复的预算，并非3个编辑动作。只允许已有的有界重规划，禁止静默裁掉动作 |
| 第3轮 | `core-v2-controller.ts:run`、`AgentV2EditorPanel.tsx` | session.turn在每次用户发送时递增；不是自动重试次数。UI说明对话轮次含义，诊断保留真实modelRequests |
| Draft | `editor-adapter.ts`、`runtime.ts:accept` | 原所有修改均要求人工Accept；增加显式直接模式，仅普通操作验证后自动调用原accept，不绕过草稿或事务 |
| 高风险确认 | `core-v2-controller.ts:run/accept` | 素材/结构/效果移除/大范围/明确预览强制留审阅。removeEffect仅在隔离草稿中允许原生编译，正式删除仍需Accept；其他危险工具不开放 |
| 场景读取 | `provider-session.ts`、`agent/read-tools.ts:registerReadTools` | 原只注册core+animation且上下文只投影有限属性；复用READ/Compositing注册与原生READ函数。宿主按任务读取，不另建模型读取循环 |
| 场景范围 | `core-v2-controller.ts:run` | 逐页读当前合成目录，最多1000项，显式treeTruncated；仅目标详情及必要效果/素材。不声称无限工程完整读入 |
| 引用 | `session.ts:resolveRequest/validate/observe` | 原序号/类型/近期引用/Selection可用，但缺名称、明确UUID、近期奇数分组中间项。补齐；多候选、多个UUID、已删除/外工程/锁定仍拒绝，不猜测 |
| 三维阻断 | `core-v2-controller.ts:run` | 原is3D/camera/model整类拒绝，屏蔽V1相同工具可表达的属性；取消整类阻断。并不新增相机创建、任意3D工具或专用模型编辑器 |
| 几何映射 | `actions.ts:executionTool`→`agent/write-tools.ts:created`→`core/project-model.ts:createLayer`→`renderers/draw-content.ts` | 矩形映射原本正确；本轮实际Scene及矩形角部像素通过。没有历史“蓝色五边形”的原始响应，不能断言重现或归因 |
| 预览一致性 | `agent/vision.ts:AgentSnapshotRenderer.render` | 原与正式输出共用Canvas2DRenderer，但未prepareMedia/检查effect错误；补上两项，保留真实PNG证据，不替换图标 |

安全限制保留：严格Native Schema、依赖/对象绑定、基版本、非目标图层保护、合成设置保护、锁定、取消、Undo、原始创建数量语义检查及最终Command replay。错误依旧区分INVALID_ARGUMENTS、INVALID_REFERENCE、MISSING_CAPABILITY、COMMAND_REJECTION、VERIFICATION_FAILURE、CANCELLED等；未开放工具不是模型质量证据。


证据目录：`docs/qa/v2-capability-unlock/`；执行脚本：`work/capability-unlock-qa/`。本轮付费 API 调用为0；离线输入不代表模型理解能力。历史 V2-7 报告及原始响应未改。
