# Agent 对象引用审计 — 0.9.28

基线为 0.9.27 `fdf8b5c`，独立分支 `codex/object-reference-recovery-0.9.28`。本轮不重建 Scene、Command System、Renderer 或 Electron。

## 历史故障证据及无法还原的部分

原生 `Swayframe/ai/history.json` 中找到会话 `cee8f75a-9a16-43a6-8de9-c63e3630e29f`，状态 failed，摘要为 `setFill 参数校验失败：layerId 无效UUID`。另有早期 `setFill 参数无效` 会话。提取结果保存在 `outputs/object-reference-028/historical-evidence.json`，未读取或输出 API Key。

旧 `src/agent/library.ts` 只持久化对话和摘要，没有 Plan、原参数、Selection、实际 Layer IDs、调用和重试 Trace。因此，历史 layerId 原值、期望对象和“两次错误”的实际调用次数无法还原。不能断言它是模型编造 UUID、名称、步骤 ID，还是错误消费工具结果。本报告不把受控复现的参数冒充历史原参数。

## 已由源码和复现确认的执行边界缺口

1. 0.9.27 `AgentTransaction.execute` 写工具只返回 `ok/commandCount/verification`；没有明确返回创建产物，没有按 Step ID 绑定真实结果。`created()` 可由核心生成合法 ID，但后续计划只能提供字面 UUID。
2. `AgentToolRegistry.validateStages` 在任何创建之前先校验全部原参数，`setFill.layerId` 仅接受 UUID；合法“创建→修改”依赖也没有语义表达方式。模型填写名称或步骤标识时直接失败。
3. 原生 `analyzeReference` 的 `registry.validatePlan(proposal.plan)` 位于 IntelligenceService 内部重试循环之外。模型通过 Proposal 外壳校验后，工具参数失败不回到该循环；Orchestrator 将整个 READ 标为“参考图结构分析失败”。这是已确认的错误归属机制，不代表历史截图每一次都能据此还原。
4. 旧规划预检先记录失败，再判断是否重复计划；相同失败可能出现两个记录。缺少历史 Trace，不能将这一可复现机制认定为用户当次“两次错误”的唯一原因。

受控复现参数：`setFill({layerId:"create_background",color:{r:0,g:0.3,b:1,a:1},gradient:"radial"})`。前置步骤 ID 为 `create_background`。这是一份明确标记的隔离复现工程；前后 Trace 为 `outputs/object-reference-028/baseline-before-after.json`。旧版拒绝 UUID 且创建结果不含显式 layerId；新版同样拒绝非法字面值，改用 `stepResult` 后解析为真实创建 ID并正确设置渐变。

## 本轮修复位置

- `src/agent/object-reference.ts`：统一引用契约、ID/类型/合成验证、实际新增对象结果提取。
- `src/agent/tool-registry.ts`：模型契约适配、依赖拓扑、预检绑定、READ/compile 执行边界解析，保留原生工具 schema。
- `src/agent/transaction.ts`：事务局部 Step Result Map、实际创建 ID 返回、重复成功步骤保护、原参数和已解析参数记录。
- `src/agent/orchestrator.ts`、`src/agent/session.ts`：Step/Task/phase/error 关联，传递 Step ID，恢复反馈附已完成结果，重复失败去重。
- `src/agent/intelligence.ts`、`src/ui/native-agent-controller.ts`：Proposal 工具验证进入专业分析的有界纠错，错误归到实际工具与步骤，服务仍只输出 Proposal。
- `src/agent/library.ts`、`src/agent/execution-error.ts`：可选、脱敏、有大小预算的诊断持久化，兼容旧历史。
- `src/agent/creation-scope.ts`：为现有范围错误补上 `OUT_OF_SCOPE_TARGET` 分类；不改变授权范围。

真实复测还发现新契约的重复展开超过消息长度上限。已移除 UUID 引用声明的冗余元数据，并从规划文本中去除已经在 READ Tool Schema 提供的重复只读契约；没有扩大消息限制或放宽 native UUID 校验。完整原生规划消息大小已有回归测试。

## 生命周期结论

创建由原 Command 编译并在共享 Draft 执行；结果从真实前后 Scene 提取，只把唯一产物 ID 绑定到 Step。后续引用在最新 Draft 解析，错误类型不转成任意 Selection。Map 不进入 Scene，不存入工程，不跨事务复用。丢弃并重建 Draft 必须重新执行前置创建、重新绑定；旧 ID 不被冒充稳定 ID。READ 不清空既有绑定。

同类风险包括 Layer、Property/Keyframe、Graph/Effect、Mask、Parenting、Asset 引用。共享注册边界递归处理其 UUID 输入；创建输出 ID 明确排除“已有目标”查询。`effectId` 兼容原图节点身份；程序包精确版本/哈希和 Forge 草稿标识保持原契约，不被误解为 Scene ID。

测试与真实 Provider 的明确边界见 `AGENT_OBJECT_REFERENCE_TEST_REPORT.md`。原始历史参数仍未知；模型漏掉要求也不能被对象解析成功掩盖。


## 可定位源码与证据

| 边界 | 修复后位置 | 证据 |
| --- | --- | --- |
| 严格语义契约 / resolver / 实际创建结果 | `src/agent/object-reference.ts:23`、`:160`、`:287` | baseline-before-after.json、agent-object-reference.test.ts |
| 分阶段预检与依赖 | `src/agent/tool-registry.ts:220`、`:238` | TEST 01/04/05/10 |
| Draft绑定与命令执行 | `src/agent/transaction.ts:20`、`:51`、`:132` | 各实际 Session 的 result.outputs/resolution |
| 专业建议工具校验纠错 | `src/agent/intelligence.ts:172` | native-agent-panel.test.tsx 的 Reference QA |
| 专业建议错误归属 | `src/agent/orchestrator.ts:217` | 实际 Step/Tool/preflight 回归 |
| 执行恢复与结果上下文 | `src/agent/orchestrator.ts:644` | Controlled recovery 回归；不冒充自发模型故障 |
| 脱敏历史 | `src/agent/library.ts:124`、`src/agent/execution-error.ts:232` | 诊断脱敏回归 |
