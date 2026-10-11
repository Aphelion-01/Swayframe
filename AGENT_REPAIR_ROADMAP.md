# Agent Repair Roadmap

审计日期：2026-10-11；业务基线：0.9.26，Git 快照 `bd2d82ca11db0f3327ad1d77cd16d7c21bcc4eb7`。
诊断分支：`codex/diagnose-0.9.26-20261011-124555`。原工作区、未提交修改和现有工程均保留。本轮未修改业务实现。
证据等级：CONFIRMED=代码及受控/真实运行证据；SUSPECTED=有依据但缺因果验证；UNVERIFIED=未验证；NOT A PROBLEM=在明确测试范围内正常。用户原始调用缺日志时另标 UNCONFIRMED。

**本文件仅建议，不实施。Recommended Strategy: PATCH + PARTIAL REFACTOR。总体风险 MEDIUM。**

技术严重度P1/P2见根因报告；以下P0..P3是用户要求的实施排序。未复现P0数据损坏，不为满足格式虚构P0缺陷。P0先解决基础契约与可靠性判定，使基础操作失败可以准确定位。

| 顺序 / 优先级 | 对应问题及修改模块 | 重构 / API兼容 | 工程兼容 | 验收与复杂度 |
|---|---|---|---|---|
| 1 / P0 | AGENT-003：`src/agent/write-tools.ts`、`src/agent/tool-registry.ts`；复用VisualCapabilityDefinition动态参数/目标能力 | PATCH；工具名和合法字段保持，收紧此前不支持的值；setScale/Rotation显式2D限制，不擅自扩展3D工具 | 不改Scene/存储格式，历史合法Fill/Graph保持 | radius/center/stops/未知ID、target类型、合法原生值；A/B/C/D同目标；中等 |
| 2 / P0 | 测试门禁：`tests/agent-fill-reliability.test.ts`、`tests/agent-text-reliability.test.ts`及新独立nativeCanvas受控测试 | 不影响运行API；CI与付费live分离 | 无 | 原失败fixtures加合法历史参数，真实Scene与PNG同步核验；中等 |
| 3 / P1 | AGENT-001：`src/agent/tool-registry.ts` validatePlan、`src/agent/orchestrator.ts`、`src/agent/creation-planner.ts` | PARTIAL REFACTOR；内部VERIFIED/DEFERRED阶段；外部工具保持；READ不静默跳过全部后续检查 | 不改工程格式 | 新建→READ→写、Graph依赖、Forge结果后验、scope与预算；中高 |
| 4 / P1 | 预算/上下文可解释：orchestrator、creation-planner、context-engine | PATCH/局部选择能力上下文；不砍掉scope/版本信息 | 无 | 明示READ/Plan/Command计数；全schema与候选schema对照，同目标质量不降；中等 |
| 5 / P2 | AGENT-002：orchestrator runSteps/fail、transaction；执行恢复边界 | PARTIAL REFACTOR；内部phase/cause/恢复状态；不改变正式Commit原子性 | 无，Undo/基线保护KEEP | 第一次参数错→下一次实参改变→一次提交；重复同错/超预算/取消停止；高 |
| 6 / P2 | AGENT-004/005：tool-registry、orchestrator、`src/agent/tool-registry.ts` AgentToolError、`src/ui/AgentPanel.tsx`现有错误展示 | PATCH；新增可选error字段，保留code/message；不新增常驻UI | 无 | details始终合法JSON；字段/target/cause/phase不丢；有界摘要而不是字符截断；中等 |
| 7 / P2 | AGENT-008/009：`src/ai/openai-provider.ts`、orchestrator、Provider manager策略 | PATCH；类型化invalid_response subtype；正文脱敏后保存服务code/field；不放宽完整性 | 无 | 400正文可诊断、JSON/SSE失败类型有限重试；missingDONE永不执行，401不无意义重试；中等 |
| 8 / P2 | AGENT-006：tool-registry verifyResults | PATCH；同ID命令归约最终预期，不减弱核验 | 无 | add/update/remove组合及多个property覆盖，合法不误拒绝，错误仍拦截；中等 |
| 9 / P3 | 视觉规划/验收：creation-planner、`src/agent/vision.ts`、`src/ui/native-agent-controller.ts`现有视觉策略及测试 | PATCH；先修能力说明/计划输出可见性，未证明需要更换Renderer | Scene/内嵌包版本/精确hash不变 | 真实非零效果、绝对path handles、生成器连Output、Cubic初稿/修正验收；中高 |
| 10 / P3 | 旧Bridge弃用清单：`src/core/agent-contracts.ts`、`src/ui/agent-controller.ts`及历史验收 | 暂KEEP，只有所有消费者核验后DEPRECATE；不是当前故障Top5 | 老项目不按旧Tool名称迁移Scene | 禁止新路径引用旧bridge；旧测试与兼容记录保留；低至中 |

文件名都来自实际仓库，未来新测试需要另命名，不假装已经存在。新增用户可见错误展示必须遵守DESIGN/固定域/现有入口，不因本报告新建全局按钮。

## Top 5 Repairs

1. 正式能力参数与目标语义契约（尤其radialParameters和2D限制）。
2. READ/生成依赖之后的阶段预检与草稿上下文。
3. 执行期有界纠错与幂等重放/一次提交。
4. 全链结构化错误，修复截断、compile包装和HTTP正文丢失。
5. 真实Tool→Command→Scene→Canvas及复杂任务验收，避免“工具成功=用户目标达成”。

## 必须保留的边界

KEEP shared CommandSystem、AgentTransaction sandbox/currentDraft read、正式基线冲突阻止、整体Undo、Scene版本、作用域、只读Intelligence Proposal、真实Renderer；KEEP Provider对JSON/SSE完整性的拒绝。不得以直接写Scene、放宽scope、执行部分JSON、eval或下载任意资源解决问题；程序化包继续declarative-pixel-v1、精确内容hash/版本、未知节点保留诊断及错误阻止导出。

## 实施完成标准

离线新增边界门禁通过，并再次跑lint/typecheck/tests/build；授权live简单任务独立重复，明确模型/provider设置与费用记录；复杂视觉任务单列判定。每个问题记录“原失败→新实现→同fixture通过”、参数、Scene diff、PNG、Undo和正式Scene无部分提交。其他Provider必须单列LIVE或UNVERIFIED。不能因当前18/18通过便宣告整套Agent已修好，也不能以一个新的视觉Prompt替代执行恢复改造。

本轮不开始修复、不升级版本、不生成新安装包；备份0.9.26及Mac/Win安装包已保全。
