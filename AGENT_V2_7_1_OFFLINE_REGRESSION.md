# V2-7.1 离线回归

**OFFLINE FIX VERIFIED / LIVE STATUS UNVERIFIED。** 本轮新增真实模型请求 **0**。Replay 不计为 Live，手工修正响应不计为模型成功。

## 可复现命令

在本独立 worktree 根目录执行，依赖使用现有本地 node_modules：

```sh
node work/agent-v2-7-1/replay.mjs ../1.0.3 docs/qa/agent-v2-7-1/replay-frozen.json
node work/agent-v2-7-1/replay.mjs . docs/qa/agent-v2-7-1/replay-fixed.json
npx vitest run tests/agent-v2-7-1.test.ts --maxWorkers=1
npm test -- --maxWorkers=1
npm run typecheck
npm run lint
npm run desktop:build
```

`replay.mjs` 将同一个 runner 绑定到指定 worktree 的真实产品模块；真实 OpenAICompatibleProvider 响应解析、ProviderBridge、AgentPlanner、TaskRuntime、EditorAdapter、Registry、AgentTransaction、CommandSystem 均运行。唯一替换是离线 fetcher 返回账本响应，禁止联网；凭据只是 offline-fixture。不是 Mock Scene/Command/Renderer，也不是新的 Planner。

## 原始响应前后对比

| 原始响应 | 冻版结果 | 修复版（关闭恢复以精确隔离初次响应） | 正式 Scene / Undo |
|---|---|---|---|
| 请求29 A1 | FAILED，DEPENDENCY_ERROR，0次动作、0层草稿 | FAILED，actions.id诊断、完整拒绝方案，0次动作、0层草稿 | 两版均不变 / 0 |
| 请求30 B1 | AWAITING_ACCEPTANCE，rectangle + text，共2层，历史语义断言 false | FAILED，actions.creation，0次动作、0层草稿 | 两版均不变 / 0 |

原始 B1失败由外部数量/类型断言复现，不将冻版 AWAITING_ACCEPTANCE 误标为成功。日志 `replay-frozen.json` / `replay-fixed.json` 含完整 runtime 状态、步骤、错误、调用数、真实草稿层和正式状态对比。

## 定向测试：19 PASS

`targeted.log`：

- 2项原始 A1/B1 响应零执行、正式 Scene、草稿、Undo不变，非法接受拒绝。
- 1项真实 provider normalization 只产生一次原始4动作，排除解析重复。
- 2项原始错误响应 + 明确手工修正第二响应，记录 rejectedIntent / 两次请求 / 一次恢复 / PLAN_REGENERATE拒绝与修复；草稿确认前正式Scene不变，确认后真实创建/颜色/尺寸/位置/文本、单次Undo/Redo、保存重载断言。
- 1项第二次错误即停止，两个拒绝事件保留，绝不循环或静默去重。
- 1项请求预算1时第二次请求被阻止，真实 transport只收到1次。
- 3项同类变体：两个椭圆、单个Orbit文本、两个矩形加一个标题；错误类型/数量统一拒绝。
- 1项模糊数量、未识别附加创建及文本内创建词不猜测。
- 1项同外观不同ID对象和不同时间同值修改不去重。
- 5项历史成功响应31/32/34/37/39依旧可执行。用最小重建上下文和原始响应，覆盖径向渐变、移动、填色、尺寸和字体。不是原历史GUI环境、原完整Scene或V1/V2新的匹配验收；填色历史响应中位置的额外变化不在本轮保证范围内。
- 1项故障注入：真实 Adapter 执行额外创建后，最终Scene新增对象校验拒绝、正式Scene/Undo保持不变。仅用 spy 注入异常，不把该注入当外部模型自然行为。
- 1项重新规划等待中取消，迟到响应无法执行，正式Scene/Undo不变。

## 完整门禁

- `regression.log`：167文件、**838/838 PASS**（原819 + 新19）；单 worker，未延长原测试超时、未降低语义断言。
- typecheck PASS；`lint.log` PASS；`build.log` desktop build PASS。构建保留原大 chunk 提示，无新增构建错误。
- 全量测试会生成历史命名 outputs；本轮生成物另存 evidence，随后仅还原此独立 worktree 的生成文件。冻结原 worktree与历史报告/账本未写入。
- 本轮没有新增 Electron GUI 语义、像素或 Windows 实机测试；不冒称端到端 Live验收。

## 产物与结论

原始失败证据、前后 replay 和运行日志在 `docs/qa/agent-v2-7-1/`。安装包及一致性记录见 `package-integrity.json` / `installers.json`。包是1.0.3基础上的 V2-7.1 定向候选；不代表 V2 已获 Canary批准。

**GO：离线局部修复可复核。NO-GO：新的 Live 创建可靠性未验证，V2 Canary NOT READY，V1继续默认。**
