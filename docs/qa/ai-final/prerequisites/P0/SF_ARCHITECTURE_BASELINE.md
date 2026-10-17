# SF 架构基线确认

审计日期：2026-10-14（Asia/Shanghai）。本轮只读取产品源码、运行验证、编写审计材料，没有修改业务代码、历史V2-7报告、Git HEAD/分支/index，没有调用付费模型。以下源码链接指向真实1.0.3工作树，不指向当前旧工作区。现场原始记录见 [SF_AUDIT_SNAPSHOT.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_SNAPSHOT.json)。

## 版本现场

| 现场 | HEAD / 分支 | 本轮开始状态 | 判断 |
|---|---|---|---|
| 当前工作区 `/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an` | `6de3dc41bb2d753651908054cecbc5dd84230b86` / `codex/autonomous-sprint-v2` | 326项既有工作区状态；产品文件未提交修改大量存在 | 无`src/agent-v2`及V2-7原报告，不能声称这是1.0.3或V2开发基线。保留原样。 |
| 审计目标 `/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3` | `c755132cd0ec76a1dfdfcb43f2cac837b466f7b1` / `codex/agent-v2-continuous-1.0.3` | clean；package.version=1.0.3 | 存在完整V1/V2与原报告，作为本轮源码审计对象。 |

`git diff 91a5d57 HEAD -- src apps package.json package-lock.json build`无差异，因此c755132的产品代码仍对应冻结91a5d57；c755132增加了真实验收证据和文档。旧工作区不是上述工作树。后续开发应从明确确认的1.0.3提交建立独立`codex/`分支/worktree，不能把当前旧工作区的dirty内容自动覆盖或混入。

## V2-7 原报告核对

已读取真实 [AGENT_V2_7_FINAL_REPEAT_ACCEPTANCE.md](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/AGENT_V2_7_FINAL_REPEAT_ACCEPTANCE.md)，并核对 `outputs/agent-v2-7/live/final-repeat/report.json`、`acceptance-summary.json`、`calls.json`和冻结源码清单。

用户摘要逐项一致：冻结91a5d57；A1失败（重复fillRed及错误createShape语义）；B1失败（矩形+真实Cubic文字，多余图层）；C1成功；C2同UUID且使用最新GUI值成功；V1/V2填色/尺寸/字体三组都成功；CANARY NOT READY；V1默认。重要补充：B1是验收断言拒绝草稿，不能说产品自动修正了语义数量错误。A2～A4及B2～B4未运行。原11次新增请求有usage，历史28次仍保留；本轮不重跑API、不把离线断言冒充模型成功率。

## 已确认的实现

| 系统 | 实际存在范围与证据 |
|---|---|
| Scene / Layer | `Project`/`Composition`/`Layer`与`createLayer`在src/core/project-model.ts；全局ID、素材引用、父子级及Graph等校验在 [src/core/project-schema.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-schema.ts:400)。有实现，不等于每种业务能力都已验收。 |
| Command / Transaction / Undo | [src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:635) 的executeTransaction、undo、redo；Zod事务契约 [src/core/command-schema.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-schema.ts:191)。原子范围为内存Project，非磁盘/工作区回调。 |
| Agent V1 | `AgentOrchestrator`、`AgentToolRegistry`、`AgentTransaction`实际存在；V1为默认。[src/agent/tool-registry.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/tool-registry.ts:76)、[src/agent/transaction.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/transaction.ts:17)。 |
| Agent V2 | [src/ui/core-v2-controller.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/core-v2-controller.ts:20)、[src/agent-v2/runtime.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/runtime.ts:103)、[src/agent-v2/editor-adapter.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/editor-adapter.ts:51)；执行通过原AgentTransaction/Registry，显式Beta选择 [src/ui/agent-runtime-selection.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/agent-runtime-selection.ts:2)。实际支持13 WRITE工具，不把V1全部能力视作已迁移。 |
| AgentPanel | [src/ui/AgentPanel.tsx](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/AgentPanel.tsx:35)根据引擎选择渲染LegacyAgentPanel或AgentV2EditorPanel，并取消不可见Panel的V2任务。 |
| Asset Management | [apps/desktop/electron/assets.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/assets.ts:9)原生文件授权/协议；[src/desktop/asset-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/asset-service.ts:57)、[src/ui/asset-import.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/asset-import.ts:10)；Scene中嵌入/链接Asset。没有证据支持“统一托管素材库、引用计数物理GC、跨文件事务”已经存在。 |
| Renderer | [src/core/renderer-core.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/renderer-core.ts:72) + [src/renderers/canvas2d.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/renderers/canvas2d.ts:38)；V2预览复用 [src/agent/vision.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/vision.ts:87)。 |
| Serialization / Electron | [src/core/project-io.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-io.ts:130)、[src/desktop/project-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/project-service.ts:10)、[apps/desktop/electron/files.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/files.ts:14)；[apps/desktop/electron/preload.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/preload.ts:9)→[apps/desktop/electron/ipc.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/ipc.ts:7)→NativeServices。 |

## 本轮实际验证及可运行方式

现有相关测试：98/98通过，见 [SF_EXISTING_TEST_RESULTS.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_EXISTING_TEST_RESULTS.json)；补充审计断言：11/11通过，见 [SF_AUDIT_REPRO_RESULTS.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO_RESULTS.json) 与 [SF_AUDIT_REPRO.test.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO.test.ts)。AUD-03～08及AUD-11通过表示成功证明边界或复现缺陷，绝不表示缺陷已修好。测试使用独立工程、模拟文件接口/位图/时序，未读取私人素材或密钥。

在1.0.3目录运行：`npm run typecheck`、`npm test -- <测试文件>`；本轮typecheck及98测试实际通过。`npm run build`=tsc+Vite；本轮分别执行tsc与`vite build --outDir <审计目录>/evidence/web-build`通过，保留大chunk提示，不改目标dist。日志 SF_TYPECHECK.log / SF_WEB_BUILD.log。

`npm run desktop:build`=Web构建+scripts/desktop/build.mjs，后者还会写build/product.json；为遵守业务现场冻结，本轮未直接重跑该命令，而按原esbuild入口将main/preload/export-worker编译到审计目录。`npm run desktop:dev`会使用固定127.0.0.1:5175且strictPort，并写outputs/desktop-dev-userdata；端口占用时不能称可运行。已打包入口为package.main=`desktop-dist/main.cjs`。

本轮使用审计包装器导入原生产main，生产preload及本轮Vite页面，在独立SWAYFRAME_USER_DATA、隐藏窗口中完成实际Electron启动，项目启动页加载、rootChildren=1，contextIsolation=true/nodeIntegration=false/sandbox=true。见 [SF_ELECTRON_STARTUP.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_ELECTRON_STARTUP.json)。外部fetch禁止，无付费API；只证明Mac本机编译应用启动，不冒充全功能GUI验收、安装包或Windows实机测试。

标准lint脚本为`npm run lint`，本轮未重跑全仓lint；历史819完整测试/质量门禁只是原1.0.3既有证据。新审计材料不进入产品目录，不要求格式化原dirty文件。安装包本轮不重建、不上传。

## 基线结论

Scene/资产路径能够确认，允许作出“复用既有系统”的审计决策；但工程切换、文件路径所有权和可保存性存在已复现缺口。**不允许现在进入P1新功能开发**。修复准入要求见 [SF_IMPLEMENTATION_DECISION.md](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_IMPLEMENTATION_DECISION.md)，风险分类见 [SF_AI_ROADMAP_RISK_REGISTER.md](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AI_ROADMAP_RISK_REGISTER.md)。
