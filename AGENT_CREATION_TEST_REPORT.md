# V0.4 Agent Creation Test Report

测试日期：2026-10-10。环境：macOS arm64，Swayframe 0.9.20。所有场景在独立工程中执行，不覆盖用户工程或正式效果库。

| 案例 | 结果 | 证据与边界 |
|---|---|---|
| A 原生径向渐变复用 | PASS（确定性） | 真实 registry / Graph / Command 创建一枚 radialGradient，无 Gaussian Blur 替代；参数保留 Property |
| B 渐变＋流动纹理＋Glow | PARTIAL | 合法原生 Graph、分支 merge、语义命名、自动布局、实际 Renderer 显示通过；纹理复用已验证 organicTexture 正弦有机近似，不是精确噪声/流体节点 |
| C 科技文字动画 | PASS（确定性） | 原生 Text、Position/Opacity Keyframes、Spring 插值，保存加载与 Undo；不使用包含文字的图片 |
| D 节点模糊 20→35 | PASS | 实际参数 diff；只修改一枚 Blur，不新增节点；预览不提交，一次 Undo 恢复20 |
| E 背景分支保留测试 | PASS（确定性） | 仅 Gradient/Glow 两节点变化；Noise近似节点、Text 内容/位置关键帧/Spring、Camera、无关矩形 Graph 深比较相等；连接和 IDs 不变；单事务、Undo/Redo、Save/Reload |
| F 最小修改 | PASS | Rectangle→Position→原生Keyframes→Spring只更改插值，保持 Graph、图层与关键帧 IDs/时间 |
| G Forge 后备 | REUSED / PARTIAL | 既有 Forge工具仍经校验/编译/预览与 AgentTransaction；新发现暴露实际能力，缺口明确。此次没有再次完成真实模型的特殊流体纹理生成，不宣称它完成 |
| Proposal 流程 | PASS | 固定真实工具响应验证 run→preview→reject/accept；正式工程修改后拒绝旧草稿 |
| Scope 攻击 | PASS | 拒绝跨节点、创建图层、拓扑/位置越界、跨分支边界；越界事务关闭，不能继续提交 |
| Canonical Node Entry | PASS | Node Inspector 在 GraphWorkspace未挂载时仍打开节点请求；默认参数范围，关闭不写Scene |

## 质量门禁

全量 tests：535 项、135 文件通过；lint、typecheck、build、desktop build 通过。feature registry / placement validation 包含在全量测试中。Vite 有原有的大块资源提示，不是编译失败。macOS 独立 dir 包构建成功，未覆盖安装版。独立profile启动已执行，但电脑锁屏使原生窗口操作验收受阻；没有原生窗口验收PASS或截图，不需将其与浏览器检查混淆。

实际浏览器检查：节点 Inspector、参数默认范围、用户切换上游分支的真实节点列表、关闭/Escape与图显示。1280×720、1440×900、1920×1080、2560×1440 的对话框均完整显示，无横向溢出；证据为 outputs/agent-creation/viewport-*.png 与 ui-geometry.json。测试场景实际使用 Renderer，截图不取代数据不变断言。新增入口没有改全局工具栏。

## 真实 Provider 验证（未通过）

使用用户已启用 openai-compatible / qwen3.8-27b，在独立合成中请求原生渐变＋Glow＋文字动画，再计划背景局部修改。第一次模型成功返回 getCanvasInfo/inspectLayer/discoverCapabilities/inspectGraph 读取调用，后续请求连接失败，未提交工程。第二次精简实际工具上下文并强制 submitPlan，服务请求超时，未返回计划。live-attempt-1.json、live-report.json 和 live.log 记录诊断与实际 Token 用量，不含密钥。

没有把固定响应测试说成真实模型开放创作能力。网络/服务状态是本轮验证边界；无有效模型计划，也就没有真实Provider接受/撤销工程可交付。可用 scripts/agent-creation-live.ts 在服务恢复后复测，不需改代码或用户库。


## 0.9.20 续轮真实 Provider 验证

PASS：应用实际规划路由为 openai-compatible / deepseek-flash，而不是列表第一个启用的 qwen3.8-27b。单节点Blur20→35通过真实规划、草稿Proposal、接受、一次Undo、保存重开（live-node/live-report.json，2592输入＋487输出Token）。完整创作与背景分支修改共5个成功返回的请求（live-followup/live-report.json）；生成原生radialGradient、glow、Text和Position/Opacity关键帧，修改背景后Text动画与Camera完全不变，预览不提交、一次Undo和保存重开均通过。测试使用真实工具和临时CommandSystem；不写用户库、工程或供应商设置。

实际Renderer打开live-followup/live-final.swayframe，显示紫色径向渐变、Glow与可编辑SWAYFRAME文字；节点Inspector与默认参数范围对话框工作。截图live-followup/node-dialog.png。自动文字配色/对齐仍较基础，不将这次结构闭环说成设计质量全面通过。此次没有重跑精确噪声、复杂Forge或外部媒体生成案例。

之前连接失败、残缺JSON、读预算耗尽、色标编码、任务覆盖、错误连线等失败均保留在live-followup/*-first.json。根据真实失败修复查询、工具说明和有限规划纠正。535项测试 / lint / typecheck / build / desktop build通过；新独立名称和appId的macOS dir包构建通过。原生自动化getApp长时间超时，因此桌面窗口操作仍UNVERIFIED，不能用浏览器PASS替代。
