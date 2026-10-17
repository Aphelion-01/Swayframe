# V2_CAPABILITY_UNLOCK_IMPLEMENTATION

源码冻结：`066e172c23ecb7f24075d284eacc7b034f3dc36b`（父版本 `3c787b2`），分支 `codex/agent-v2-capability-unlock`，产品版本 `1.0.3`。

本轮是局部扩展原V2，不是V3或V1包装器。

1. `src/agent-v2/actions.ts`：扩大原语义属性/关键帧枚举、effectKinds；两个有限适配动作createNative/editNative使用固定工具名，参数最终仍由原Registry严格校验。64KB参数上限在Adapter执行前检查；不支持任意命令/脚本。
2. `provider-session.ts:createProviderCoreV2`：同一个AgentToolRegistry上复用registerCoreWriteTools/registerAnimationTools/registerCompositingTools/registerReadTools。没有调用V1 Agent，也没有创建第二套Registry/Planner。
3. `editor-adapter.ts:prepare/execute/verify/commit`：显式target注入layerId，禁止args覆盖身份；propertyId校验属于目标图层，原stepResult绑定继续工作。矩形/椭圆/文字不得绕native createLayer避开原语义后置条件。原权限、Schema、compile、scope及Command replay均保留。
4. removeEffect的DESTRUCTIVE权限只用于隔离草稿编译（白名单中唯一DESTRUCTIVE）；它始终不属于直接模式安全集。只有原TaskRuntime.accept才进入正式工程；原生Undo恢复删除节点。未开放其他危险工具。不能把这一限定解读为允许任意DESTRUCTIVE执行。
5. `planner.ts:AgentPlanner.plan`：传入实际Native参数契约，保持单次submitIntent协议；创建禁用时Schema隐藏createNative。输出上限6000，恢复2000，原100动作及有限请求/时间预算不变。`recovery.ts:validateRepair`禁止恢复换工具或悄改native args。
6. `session.ts`：名称/明确UUID/类型/近期创建组中间项定位及“只创建”识别；旧Scene失效与序号稳定规则保留。不是任意自然语言空间关系解析器。
7. `core-v2-controller.ts`：按任务调用原READ实现、当前Scene重新定位、普通编辑自动accept、需审阅回退。自然语言Undo使用原历史且检查成功，失败不虚报。
8. `agent/vision.ts`：使用原Canvas2DRenderer补齐媒体准备及效果错误检查；错误效果阻止“验证成功”。
9. `AgentV2EditorPanel.tsx`、`feature-catalog.ts`：复用assistant.actions参数入口及scoped Command；新能力不放全局工具栏，元数据无业务回调，模式不保存进Scene。成功直接任务清空其原输入；失败及用户运行中改写的新输入保留。

保留：V1全局默认、V2显式Beta选择、review默认、共享事务与一次Undo、真实预览、非目标和合成保护、基版本/工程切换/取消、失败停止、原A1/B1创建数量检查。未增MCP/共享Gateway/新的全局注册表。

源码证据冻结见source-files-sha256.json；质量门禁：typecheck、lint、desktop:build通过，完整单元922/922。首次默认高并发918/919（一个100动作用例5秒超时）；降低测试并行度至2后，未放松断言或产品预算，全量通过。旧测试中仅更新新参数契约/READ字段和已解除3D整类限制的预期。


证据目录：`docs/qa/v2-capability-unlock/`；执行脚本：`work/capability-unlock-qa/`。本轮付费 API 调用为0；离线输入不代表模型理解能力。历史 V2-7 报告及原始响应未改。
