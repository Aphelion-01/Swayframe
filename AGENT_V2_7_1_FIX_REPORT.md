# V2-7.1 定向修复

**OFFLINE FIX VERIFIED；LIVE STATUS UNVERIFIED；CANARY NOT READY；V1 保持默认。**

## 改动

只修改 `src/agent-v2/planner.ts` 与 `src/agent-v2/runtime.ts`，复用原 Planner、intentSchema、ProviderBridge、Registry、EditorAdapter 和 AgentTransaction。

- `validateIntent(raw, trustedGoal)` 保留严格 Schema / 唯一 ID / 引用 / 拓扑校验；重复 ID 错误携带完整 rejectedIntent，绝不删步或改名。
- `creationContract()` / `validateCreationContract()` 提取明确创建子句的数量与类型；发送给同一个 Planner，同时作为宿主预执行检查。模型改写 intent.goal 无法撤销可信 goal 的约束。
- `TaskRuntime.planAndRun()` 对重复 ID 或明确创建数量/类型冲突，且尚未执行动作时，至多重新规划一次。原错误及完整方案写入 errors，PLAN_REGENERATE 的拒绝/修复结果写入 recoveries。第二份同样无效时保留两个拒绝事件，停止。
- 重新规划消耗现有 modelRequests、recoveries、输入/输出、取消、期限和 snapshot 检查；不提高预算，不回滚已执行步骤后重放，不给 Planner commit 权限。
- `verifyCreatedObjects()` 在 draft 验证和 accept 提交前，对 base/draft 新增真实对象再次检查数量/类型。只数新对象，不错误地把旧 Scene 已有对象算进本次创建要求。
- `run(raw)` 作为低层调用入口没有独立人类 goal，使用调用方 raw.goal；GUI 产品路径使用 planAndRun(trustedGoal)。不能把低层 raw.goal 当作任意外部自然语言任务的可信授权。

## 验证与限制

见 `AGENT_V2_7_1_OFFLINE_REGRESSION.md`：精确原始响应在冻版和修复版分别运行，19项定向测试及完整838项回归通过。修复后原始错误响应仍然应当失败；正确第二次响应来自明确标注的手工夹具，证明恢复控制流和真实 Command/Transaction 可执行，不证明模型会生成正确重规划。

已知边界：创建约束仅覆盖明确中文创建子句，不是全语义解析器。未实现不相关现有属性“保持不变”的通用约束，也未增加全局权限抽象或 Schema。历史请求34在“改蓝色”之外还输出位置修改；这属于额外属性语义审计范围，本轮不将其历史 PASS 扩大为所有属性保持不变 PASS。

普通合法任务不额外请求模型；定向不合法规划至多增加一次请求，并受原预算限制。没有新增付费调用，历史总账不变。V1 默认定义 `src/agent-v2/index.ts::defaultAgentRuntime` 不变。

安装包属于基线1.0.3上的 V2-7.1 诊断候选构建；没有提升为正式 Canary 或默认 V2。Mac arm64 / Windows x64 构建信息及哈希见证据目录；未签名、未公证，Windows 未实机运行。
