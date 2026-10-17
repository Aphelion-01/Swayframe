# Agent Object Reference Test Report — 0.9.28

## 离线结果

全量 614 项测试通过，0 失败。`outputs/object-reference-028/offline-tests.json` 保存原始结果。lint、typecheck、desktop:build 均通过；构建保留既有 bundle 大小提示，不将提示误报为失败。

`tests/agent-object-reference.test.ts` 覆盖任务 TEST 01–12：创建与 Fill；Text 的 Position/Opacity/Keyframe；两个独立结果；创建后的 READ；节点创建/连接/参数；单选；多选歧义；合法但不存在 UUID；非法 UUID；前置失败与前向引用；Draft 重建与重放保护；并发人工修改的 commit 基线。另覆盖类型/合成/失效/缺失目标、范围关闭、诊断脱敏、Proposal 纠错与重复拒绝、真实 Orchestrator 的单次提交以及受控执行恢复。所有“受控故障”明确为脚本注入，不冒充模型自发故障。

`tests/native-agent-panel.test.tsx` 补测完整原生规划消息的长度边界，以及参考图建议出错时的实际 Step/Tool/phase 归属。原参数保留，图片正文不进入诊断，正式工程未变。

前后复现：`outputs/object-reference-028/baseline-before-after.json`。历史摘要证据：`historical-evidence.json`。复现 marker `create_background` 是受控测试参数，历史原值未知。

## 受控真实 DeepSeek 结果

使用实际原生安全凭据与 `DeepSeek/deepseek-flash`。每项独立临时工程，实际 Native Agent、AgentTransaction、CommandSystem 与 Canvas Renderer；为限制调用量强制 submitPlan，不开启自由 READ 轮次、自动视觉 LLM 或外发图片。不是完整自由运行测试，也不是参考图视觉重建验收。

实际调用 3 次，151,528 输入 tokens、2,131 输出 tokens。原请求/响应在 `live-calls.json`，原 Session、工程和 PNG 分别保存。`live-review.json` 是独立检查结论，未重写原结果。

| 任务 | Tool/引用/执行 | Scene | 实际渲染 | 任务完成 |
| --- | --- | --- | --- | --- |
| 矩形→蓝色径向渐变→位置 | 通过，真实 StepResult | 通过 | 渐变与位置正确 | 通过 |
| 两矩形分别蓝/红填充 | 通过，两个真实结果分别解析 | 通过 | 两层颜色/位置正确 | 通过 |
| 文字→字号/位置→透明度动画 | 返回的创建步骤执行通过 | 失败：模型未返回两条透明度关键帧 | 文本确实可见；缺失动画 | 未完成 |
| 背景→渐变/Glow→文字 | 未发出 Provider 请求，预算拦截 | 未验收 | 未验收 | 待测 |
| 创建节点→连接→参数 | 未发出 Provider 请求，预算拦截 | 未验收 | 未验收 | 待测 |

前两项均验证单次 commit、保存重载、一次 Undo 和 Redo。模型说完成不等于任务完成，第三项没有计入成功。预算停止案例中的旧测试脚本 Undo 标志不构成正式提交证据，已在独立 review 排除。

前期脚本适配和两轮契约长度失败在本地拦截，未调用外部 Provider；原始失败记录单独保留为 `runner-setup-failure-no-provider-calls.json` 和 `pre-provider-schema-failure*/`。

## 尚未完成的真实验收

任务文件要求在扩大完整重复测试前取得明确 API 预算授权，已提出：5 类任务各 2 次、最多额外 20 次请求、累计输入最多 100 万 tokens（含重试）。当前等待授权，未进行该批调用。不能宣称五类重复验收已完成，也不能宣称用户旧参考图故障的原参数已找回。
