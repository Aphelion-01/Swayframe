# Agent Core V2-7.1 根因

## 冻结与证据

修复基线 `9cf8ca1`（最小真实编辑内核验收修复）；Agent 源码仍为 V2-7 冻结产品。独立分支 `codex/agent-v2-7-1-reliability`，未修改原 dirty 工作区、1.0.3 worktree 或历史报告。

已读取 `AGENT_V2_7_FINAL_REPEAT_ACCEPTANCE.md` 原文：冻结产品 `91a5d57`，A1/B1 FAIL，C1/C2 和三组 V1/V2 对照成功，CANARY NOT READY / Legacy V1 默认，与用户摘要一致。历史证据归档 HEAD `c755132`。SHA256 见 `docs/qa/agent-v2-7-1/evidence-manifest.json`。

账本请求29/30的完整请求体、响应对象及 usage 复制为 `call-29.json` / `call-30.json`；`A1-record.json` / `A1-trace.json`、`B1-record.json` / `B1-trace.json` 保留原始错误与任务状态。保留模型的原始 arguments 字符串，不将重新格式化的 JSON 称为原始 HTTP 字节。

A1 原始用户请求：`创建三个矩形，按创建顺序填充红色、绿色、蓝色。每个宽240、高200，位置依次为(400,540)、(800,540)、(1200,540)。`

B1 原始用户请求：`创建一个文字标题，内容为Cubic，放在合成中心(960,540)，不要添加其他图层。`

## A1

1. **源码、原始响应与离线运行证实**：请求29只有一个 submitIntent tool call，arguments 中已有四个 createShape：rect1 / fill1 / fillRed / fillRed。后三个依赖 rect1，没有 setFill。错误首先由模型输出产生；不能进一步证明供应商内部采样/解码原因。
2. `src/ai/openai-provider.ts:55` 的 `response()` 对第一 choice 的 tool_calls 各解析一次 JSON；`src/agent-v2/provider.ts` 的 `ProviderBridge.request()` 要求且只接受一个完整工具调用，将 arguments 原样交给 Planner。生产解析器离线断言确认4个动作恰好一次，没有响应拼接重复。
3. `src/agent-v2/actions.ts:16` 的 LayerReference.result 使用 actionId，`dependencies():170` 合并显式 dependsOn、target.result 和 modifyKeyframe.result，再去重依赖引用；执行 `TaskRuntime.resolve()` 从成功动作的真实 outputs.layerId 建立引用，不由模型生成 UUID。
4. `validateIntent()` 在拓扑排序前要求 action.id 唯一，重复 fillRed 使结果引用无法唯一解析，原错误为 `DEPENDENCY_ERROR 动作标识重复`。并非四个动作本身都会造成依赖错误：四个不同 ID 可通过原校验，但仍违背三个对象目标。
5. 原冻版本精确响应 replay 为 FAILED / actionAttempts=0 / 草稿0层 / 正式 Scene 不变 / Undo0；原提交阻断正确，无需降低此校验。
6. 原通用机制检查重复 ID，不检查不同 ID 的相同动作内容。修复保留此原则，增加完整拒绝方案和重复 ID 诊断；创建数量/类型约束补上“重复创建但换 ID”的缺口。
7. 不按 payload 删除重复：相同外观的多个对象、不同时间的同值属性修改均可能合法。它们有不同动作身份时完整保留。相同 ID 始终拒绝，不自动重命名。缺失颜色的响应不能靠去重恢复为用户要求；必须重新规划或明确失败。

## B1

1. **源码与原始请求证实**：原文“不要添加其他图层”进入 Planner 的 user message，system 也已提示对象数量与真实 createText。不是用户约束丢失于传输。
2. `actions.ts:134` 的 intentSchema 只定义合法动作及1～100步；createShape 与 createText 同时出现符合 Schema。没有可信目标数量/类型，模型自己写的 goal 不能作为安全约束来源。
3. 原 `verification.ts::verifyAction()` 验证每个动作产生正确对象，不验证整个任务应当只新建一个文字。`EditorAdapter.validateScope()` allowCreate=true 时允许注册工具创建多个对象。原代码缺少提交前目标约束。
4. 精确冻版本 replay 得到 AWAITING_ACCEPTANCE、两层 rectangle/text；原外部 `work/agent-v2-7/live-final-renderer.tsx:71` 对 layers.length===1 / type===text / text===Cubic 拒绝；这是 QA 语义拒绝，不是原产品自动发现并修好。
5. 修复从可信用户 goal 提取明确创建子句的数量和对象类别，在既有 validateIntent 内验证，再对实际 draft 相对 base 的新增对象验证，接受时重验。额外矩形等新增副作用被统一阻止。普通样式、尺寸、动画动作仍合法；Scene 权限/事务校验保留。
6. 保守识别中文明确创建子句，支持数字/一至十、多个明确子句、矩形/椭圆/文字/文本/标题。不支持的数量、未解析附加创建、引号文字内创建词等返回 null，不猜测。没有 Cubic、RGB 或特定对象坐标规则。

## 边界与分类

- 已由源码和测试证实：A1 模型动作重复，解析不重复，原依赖安全阻断；B1 缺少目标创建约束，原外部 QA 才拒绝；局部修复可安全拦截、审计及有限再规划。
- 合理风险尚未 Live 复验：重新规划的模型仍可能重复错误，颜色/内容/位置也可能语义错误；因此第二次不合法即停止，不能宣称创建可靠性已达到 Canary。
- 缺乏证据：学校服务内部解码根因、其他模型成功率；不归咎 SDK 或供应商。
- 无需修复：原 Schema 严格性、ID 唯一性、result 引用权限、用户接受及事务隔离。

本轮创建约束不是完整自然语言语义校验，不验证一切“只”约束，也不据此授权额外的现有对象修改。现有对象仍受原 MutationScope 保护；未明确解析的任务不能宣称已获得完整禁止副作用保证。
