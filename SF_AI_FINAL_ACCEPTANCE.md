# Swayframe AI Integration Final Acceptance

日期：2026-10-16（Asia/Shanghai）。**整体 NO-GO。** AI2Comp Import / MCP Bridge 可在本报告限定的本机Mac范围内 GO；Agent V2 / Automatic Layer Separation 不批准一般发布。未修改产品业务代码、未新增功能、未调用付费模型。

配套报告：[安全复核](SF_AI_SECURITY_FINAL_REVIEW.md) · [发布判定](SF_AI_RELEASE_READINESS.md) · [已知限制](SF_AI_KNOWN_LIMITATIONS.md)。

## 冻结与前置核对

- 本轮基线 `3cc53a59d32ed021aaf58d5274a564950721ac28`；独立分支 `codex/ai-integration-final-acceptance`，独立工作树 `Swayframe_Repairs/ai-integration-final-acceptance`。本轮完成提交由Git记录，运行基线始终是上述产品提交。
- 读取37份相关阶段报告：P0五份、P1三份、V2-7冻结原报告、V2-7.1四份、P3/P4、P5、P6、P7、外部工作流。文件名及SHA256见`docs/qa/ai-final/prerequisite-reports.json`。P0在原工作区，原文只读复制到本轮prerequisites/P0，不改原文。
- V2-7原结论核对一致：91a5d57，A1/B1 FAIL；C1/C2及三组V1/V2编辑对照通过，CANARY NOT READY，V1默认。原A2～A4/B2～B4未运行，不补记PASS。
- P0旧缺陷不当作当前已复现缺陷：本轮沿用P1/P3已修复的所有权、可保存性、原子内嵌资产机制并重新验证。禁止重写历史FAIL。

## 阶段状态

| 阶段 | 当前实现及证据状态 |
|---|---|
| P0 / P1 | 审计及限定2D核心验证完成；历史NO-GO由后续定向修复承接，不修改旧结论 |
| V2-7.1 | 离线局部修复已实现；OFFLINE FIX VERIFIED；新增Live NOT RUN / UNVERIFIED |
| P3 / P4 | 严格Layer Package v1及编辑器预览/确认/取消已实现并实测 |
| P5 / P6 | 七项薄适配及显式授权本机MCP已实现并实测；非远程Gateway |
| P7 | Apple Silicon Mac本地双层原型已实现；一般自动分层质量未达发布要求 |
| 外部工作流 | 带GUI协助的通用外部Agent工作流已验证；GPT Work未验证 |
| Windows自动分层、Inpainting、可选前景深度推断、自动原生Text/复杂形状重建 | **NOT IMPLEMENTED**，不得因其他模块通过而补PASS |
| MCP首次创建动画、MCP保存工具、公网监听/任意脚本工具 | **NOT IMPLEMENTED**（有意不开放）；使用原生GUI能力不算MCP已实现 |
| GPT Work专属SF集成 | **NOT IMPLEMENTED / NOT VERIFIED**；不等于OpenAI平台不存在对应能力 |

## 本轮有效运行统计

| 测试集合 | PASS | FAIL | 证据 |
|---|---:|---:|---|
| 原生编辑内核 / 独立进程重开 | 17+1 | 0 | native/current |
| 正式dist GUI↔独立MCP客户端 | 29 | 0 | cross/run |
| AI2Comp GUI / 独立重开 / 窗口关闭 | 15+1+1 | 0 | import-ui/run、close-run |
| MCP真实SDK / 独立客户端关闭观察 | 14+5 | 0 | mcp/current、window-close |
| 本地真实照片分层与导入 | 17 | 0 | separation/current |
| Agent V2真实Electron离线交错 | 5 | 0 | agent-electron |
| 导入内核 / 独立进程重开 | 21+1 | 0 | import/runs/verified |
| **最终Electron场景合计** | **127** | **0** | summary.json |
| 原有/新增单元及集成回归 | 908 | 0 | all-tests.json，单worker、原时限不变 |
| 其中V2-7.1定向离线 | 19 | 0 | 是908的子集，不重复计数 |
| 跨入口真实帧的独立像素/变化范围对照 | 5 | 0 | cross/run/visual-report.json，另列不累加Electron数 |

这些计数按测试case，不按单个断言、工具次数或模型成功率。拒绝非法输入符合预期计为“安全拒绝PASS”，绝不算一次成功编辑。不用合并成功率掩盖未准入模块。

## 原生 GUI 矩阵

创建层：cross/run通过正式LayerPanel“创建对象→创建 矩形”；MCP立即查询同UUID。修改属性、开启动画、当前时间/关键帧、Undo/Redo：import-ui实际React控件；保存/重开真实ProjectService、IPC和atomicWrite；native/current包含真实Canvas2DRenderer位置/透明度/顺序/可见性Golden。不是只检查render未抛异常。

## AI2Comp 矩阵

正确三层完整/裁切PNG、坏路径包、损坏PNG、非法JSON、缺失图片、预览/读取/提交前取消、立即Undo/Redo、共享Asset重复导入、源包删除后保存重开、逐层编辑/关键帧及真实渲染均重新运行。正式提交仍是原Command/Transaction；损坏第二图片、事务末尾无效命令、真实可解码PNG使工程超过20MB时，不发布第一部分资产/图层。

## MCP 矩阵

真实官方Client通过stdio子进程→loopback鉴权→Electron IPC操作原生Scene。project/tree/layer/selection查询、指定层写入、真实包导入、PNG渲染、错误参数/未知字段/已删除层、错token/只读拒绝、重复requestId、旧revision、取消/断开后真实IO晚到、切工程、关闭、保存重开后再编辑全部有本轮记录。cross是独立Node客户端；mcp/current客户端位于QA主进程但使用实际协议子进程，不冒充独立客户端拓扑。

## Agent V2 矩阵（仅离线）

- 原始请求29/30及响应原文仍在`docs/qa/agent-v2-7-1/`，SHA见inputs.json。真实Provider解析/Planner/Runtime/Adapter/Transaction进行离线重放。
- frozen replay：A1 FAILED/0草稿，B1 AWAITING_ACCEPTANCE/2层、语义不符；正式Scene均不变，Undo0。
- 当前replay：A1/B1均FAILED、0动作提交、0草稿层、Undo0，拒绝原错误响应是预期，不假装模型现已生成正确响应。
- 定向19项包含五个原冻结PASS响应31/32/34/37/39、恢复夹具/变体/取消/错误额外对象。其jsdom Renderer替身不计真实像素或Live证据。
- 新增真实Electron离线5项使用明确的受控Provider：同一App/Store的真实Controller/Runtime/AgentTransaction和实际Renderer，无Renderer替身。接受、Undo/Redo后输出真实PNG；V2等待时点击真实GUI创建、实际load切工程、主动取消，晚到结果均不覆盖用户状态；无效opacity=2的失败草稿不留下前一个创建动作。
- 该失败注入还触发一次受控修复请求，离线队列未提供新响应而明确失败。共6次fixture请求、0付费API；这不是新的模型失败率样本。

## 八项跨入口操作

| 要求 | 实测证据 |
|---|---|
| GUI创建→MCP修改 | cross/run：原UI创建UUID，外部改位置，读取实际属性 |
| MCP修改→GUI Undo | cross/run：真实快捷键Undo，完整图层对象恢复；再Undo原GUI创建回到空合成 |
| AI2Comp导入→GUI编辑 | import-ui：选择Subject、Inspector改位置、原秒表和时间轴关键帧 |
| AI2Comp导入→MCP查询 | cross/run：真实包导入后读取四层及详情 |
| GUI切工程后旧MCP返回 | mcp/current：真实读取暂停返回，原store.load换工程后释放；新Scene不变、授权撤销 |
| V2运行期间GUI修改Scene | agent-electron：离线Provider等待期间原GUI创建，真实Controller取消，用户Scene/历史保留 |
| 导入中取消/关闭工程 | import-ui、mcp/window-close、native/current：真实IO完成后延后返回，取消/关闭/切换后不提交 |
| 保存重载后继续操作 | import-ui新进程再次Inspector编辑；mcp/current新连接继续编辑；cross重开并渲染动画 |

GUI、ProjectService或store.load的具体入口如上区分；不是每条切换都经过系统文件选择器。受控系统选择器返回仅选择本轮自有目录，没有人工逐次点选或Windows实机PASS。

## 质量和失败单独披露

本轮覆盖路径中观测到：正式Scene污染0、素材丢失0、Undo异常0、保存重载失败0、渲染错误0、未授权写入0；无需人工修复工程。不是对任意输入、所有竞态或所有平台的零缺陷证明。

初始导入core/current为19 PASS / 1 FAIL（新进程重开另1 PASS）：继承P3 QA仍查找旧菜单“导入图层包…”，当前P4名称为“导入分层合成…”。只更新本轮QA定位并新增超大PNG拒绝，verified为21/21；原失败及截图/日志保留。Agent QA首次编译缺闭括号，未启动产品；修正QA后5/5。不得把这两项隐去或计为产品新缺陷修复。

真实日志仍保留非致命Electron资源/DevTools/QA worker提示；未把ZIP worker或全部媒体导出计为PASS。自动分层毛发残边/背景洞是已知质量限制，不能由127项工程安全PASS抵消。

## 冻结证据与命令

环境：Apple M5、16GB、macOS27.0.1 build26A434，Electron44.5.1 / Chromium152.0.7977.130 / Electron Node24.21.0；每套独立`/private/tmp/sf-ai-final-*` profile，未使用用户工程或凭据。见environment.json。

`docs/qa/ai-final/`保存基线、37份前置报告hash、输入hash、replay、实际Scene/工程、日志、截图和Renderer PNG。旧测试生成的四个outputs副本已归档unit-generated，再仅将本新worktree恢复至基线；冻结报告、旧工作区及账本原样。

```sh
npm run desktop:build
npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/ai-final/new-unit.json
# 先运行各work/final-*-qa目录中的build.mjs（native为minimal-build.mjs）。
SF_ELECTRON=/absolute/path/to/Electron node work/final-acceptance-runner.mjs
node work/agent-v2-7-1/replay.mjs . docs/qa/ai-final/new-replay-fixed.json
node work/agent-v2-7-1/replay.mjs ../1.0.3 docs/qa/ai-final/new-replay-frozen.json
node work/final-agent-qa/build.mjs
SWAYFRAME_USER_DATA=/private/tmp/sf-ai-final-agent-new "$SF_ELECTRON" work/final-agent-qa/.compiled/desktop-dist/main.cjs
```

runner包含固定自有证据路径；复跑必须先复制本轮目录，并在QA参数中使用新路径，不能覆盖本次冻结报告。所有实际命令另见commands.md；不运行旧P3/P4固定输出脚本覆盖旧证据。

标准lint、typecheck（desktop:build包含）通过。本轮无产品修复，源码与基线相同。Mac/Windows安装包是按用户约定生成的**诊断候选**，不是统一AI正式发布；unsigned、Mac未公证、Windows运行未验证，SHA/载荷对照另存。
