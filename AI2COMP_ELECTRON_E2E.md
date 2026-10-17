# AI2Comp 实际 Electron 验证

结论：本机 Mac Electron 的指定原生编辑链路通过。证据来自真实产品 App、preload/IPC、文件系统、PNG 解码、Command/Transaction、ProjectService 和 Canvas2DRenderer。没有替换 Scene、Renderer 或用 Mock 图像宣称端到端成功。**Windows 运行未验证。**

## 证据分层

| 证据 | 结果 | 边界 |
|---|---|---|
| `docs/qa/ai2comp-editor/initial/records.json` | 真实 OS 文件夹选择→预览/确认、立即 Undo/Redo、真实 OS 取消选择通过 | CUA 实际点击产品文件菜单和系统目录选择器；该次后续编辑脚本误点行容器而失败，整轮不是 PASS |
| `docs/qa/ai2comp-editor/native-run/records.json` | 再次真实选择/预览/确认/Undo/Redo通过 | 保留后续控件定位失败；不取代最终自动验收 |
| `docs/qa/ai2comp-editor/run/report.json` | **15/15 PASS** | 实际 Electron；文件菜单和真实 React 控件触发业务。目录选择返回自有 fixture 路径以确定复现时序；不宣称这 15 项都是手动系统选择器操作 |
| `docs/qa/ai2comp-editor/run/reopen-report.json` | **1/1 PASS** | 新 Electron 进程读取真实保存工程，结构/关键帧/内嵌素材存在，再次通过 Inspector 编辑并渲染 |
| `docs/qa/ai2comp-editor/close-run/close-report.json` | **PASS** | 真实 BrowserWindow.close→产品 main close handler→原 ProjectService 关闭；真实读包结果已准备但仍待返回，磁盘工程保持不变 |
| `docs/qa/ai2comp-editor/unit-tests-final.json` | **870/870 PASS** | 单元/集成回归，新增位图替身只在单位测试使用，不作为真实解码/渲染证据 |

原始日志：`electron-final.log`、`electron-reopen.log`、`electron-close.log`、`run/console.json`。最终报告的 `networkAttempts=0`、`modelAttempts=0`。首次测试统计曾把 `ai.*` 配置读取也算作模型尝试并拦截；已改为只统计 chat/models/test，首次报告不改写、不计为付费调用成功。

## A–J 原生编辑流程

样例 B 是真实三层裁切透明 PNG，64×48，Scene 顺序为 Background→Subject→Foreground（底→顶），预览按顶→底显示。原 Asset 保存为内嵌 PNG，不依赖临时源目录长期存在。

| 步骤 | 实际入口与断言 |
|---|---|
| A 导入三层 | 产品文件菜单 import-layerpack → LayerPackImportDialog → 系统选择/校验预览 → 确认 → 原 importer/Transaction。预览期间完整 Scene 和 Undo 不变；确认后恰好一项 Undo、三层、三个 Asset |
| B 选择第二层 | 原 LayerPanel 的 `选择 Subject` 按钮；真实 selection 含该层 UUID，时间轴原属性行展开 |
| C 修改位置 | 原 Inspector `位置 X` 输入/确认；Scene X 从20到26，其余图层保持原位置。原生 XY 链接行为保留，未另写属性更新器 |
| D 添加关键帧 | 原 `开启位置动画` 秒表记录0秒；原 `当前时间（秒）` 到1秒，修改原位置输入到38，自动记录第二帧 |
| E 渲染 | 同一 Scene 经原 createRenderSnapshot→Canvas2DRenderer.syncAssets/prepareMedia/render 输出 PNG。64×48=12,288通道；两帧有1,500个通道变化；背景内部像素蓝色断言通过，非“函数没抛异常” |
| F Undo | 点击原“撤销”，导入后立即还原完整导入前 Scene/资产与历史 |
| G Redo | 点击原“重做”，完整规范化 Scene/UUID/资产与导入后完全一致 |
| H 保存 | 点击真实文件菜单“保存工程”，已绑定原 ProjectService；真实 IPC/atomicWrite，磁盘文件与 store.save 字节一致。测试预先为自有路径 recover 绑定，不把未测试的 Save As 交互算通过 |
| I 重新打开 | 原 ProjectService.closeProject/open（自动调用服务，不冒充点了系统打开对话框）；磁盘读回结构、UUID、内嵌 Asset、动画一致。另有全新 Electron 进程验收 |
| J 再次编辑 | 原选择按钮和 Inspector 再改位置，Scene 实际改变；新进程同样可再次编辑/渲染 |

F/G 在导入成功后立即执行，以覆盖最后一项异常要求；不声称按 A–J 字母顺序执行。保存与打开服务使用产品原实现，没有测试专属序列化或工程状态。

产物：`run/native-preview.png`、`run/second-layer-edited.png`、`run/native-timeline-keyframes.png`、`run/reopened-edited.png`、`run/fresh-process-reopened-edited.png`、`run/edited-frame-0.png`、`run/edited-frame-1.png`、`run/fresh-process-edited.png`、`run/editor.swayframe`、`run/reopened-scene.json`、`run/render-check.json`。

渲染约定沿用 P3：sRGB 输入，Canvas 2D，8-bit straight RGBA 读回，原 source-over。未改 Renderer/颜色管理；这里动画变化是精确结构/像素变化检查，P3 透明边缘和叠加 Golden 比较不被替换。未宣称线性光/HDR/跨机器字体一致性。

## 异常验收

| 情况 | 检查 |
|---|---|
| 取消文件选择 | CUA 真系统取消证据 + 最终自动目录返回 null；显示“已取消”，Scene 未变 |
| 无效 manifest | 真实 `{broken` 文件经原 native parser 拒绝；失败提示/禁用确认/Scene 不变 |
| 缺失 PNG | 实际删除自有样例 Subject PNG 后读取失败；显示缺图和具体路径，确认禁用，Scene 不变 |
| 关闭窗口 | 独立 close-run，读包结果延后返回时调用真正 win.close；实际窗口关闭，保存文件未变。不是只模拟 beforeunload |
| 切换工程 | 原 store.load 替换工程，释放真实读包结果；显示取消，新 Scene/空历史保持。切换动作自动调用真实产品方法，不伪装系统菜单点选 |
| 连续点击 | 再次派发菜单所属原 import event 只聚焦现有弹窗，选择器调用仅增加一次；同一确认按钮连点只提交一次 |
| 完成立即 Undo | 原 UI 撤销完整恢复导入前 Scene/资产，不只比较历史长度 |
| 校验中取消 | 延后真实 native 返回，点击取消后释放；不发布旧结果 |
| 导入中取消 | MutationObserver 在实际 importing DOM 状态出现后点击原取消按钮；提交前 guard 拒绝，Scene 未变。没有伪造 prepared 数据 |
| 预览取消/Escape | 原按钮和 Modal 键盘处理关闭/取消，不写 Scene |

IO gate 仅延后真实 NativeServices.dispatch 结果；严格解析、磁盘读取、nativeImage/createImageBitmap 均执行。失败没有降低 Schema，也没有静默删动作/图层。

## 开发与验证中断记录

- `initial` / `native-run`：脚本点 `.layer-row` 容器，而实际选择绑定 `.layer-select` 按钮；改为原带 aria-label 选择控件。
- `automation-initial`：误读 EditorStore 的 `currentTime`，真实字段是 `time`；测试定位修正，不修改产品时间语义。
- `importing-state-initial`：React 批处理让 importing DOM 状态赶不上提交；局部使用 flushSync 发布状态，原提交前取消校验保持，最终回归 PASS。
- 高视口早期截图曾被物理窗口裁切；最终改用 Chromium DeviceMetricsOverride + Page.captureScreenshot，四种实际视口尺寸断言及最终完整截图通过。旧裁切截图不能作为大视口视觉通过依据。
- `native-timeout` 以及后续 `native-final` 补跑：CUA 多 Electron 实例定位/系统目录导航及接口长时间无响应中断；不计为通过，不宣称最终完整鼠标回放通过。此前真 OS 导入/取消证据与最终真实 Electron 自动流程分别保留。

## 复跑命令

在本工作树运行（需已有依赖和可用桌面会话；使用独立测试 profile）：

```bash
node work/ai2comp-editor-qa/build.mjs
SF_QA_AUTOMATED=1 SWAYFRAME_USER_DATA=/private/tmp/sf-editor-acceptance ./node_modules/.bin/electron work/ai2comp-editor-qa/.compiled/desktop-dist/main.cjs
SF_QA_REOPEN=1 SF_QA_AUTOMATED=1 SWAYFRAME_USER_DATA=/private/tmp/sf-editor-reopen ./node_modules/.bin/electron work/ai2comp-editor-qa/.compiled/desktop-dist/main.cjs
SF_QA_CLOSE=1 SF_QA_AUTOMATED=1 SWAYFRAME_USER_DATA=/private/tmp/sf-editor-close ./node_modules/.bin/electron work/ai2comp-editor-qa/.compiled/desktop-dist/main.cjs
```

不设置 `SF_QA_AUTOMATED` 时等待真实文件菜单/系统选择器/确认按钮；在 `REAL_NATIVE_CANCEL` 检查点再次打开菜单并取消系统选择器。QA仅授予自有 fixture/输出目录、采集证据、控制实际IO返回时机；桥不打入安装包。不启用真实用户 profile 或模型服务。

上述固定输出目录会覆盖本分支复跑产物；重跑前复制该目录或修改 main.ts 中输出位置，不覆盖冻结原报告。IIFE 构建保留未执行 ZIP worker 的 import.meta 警告；本验收不覆盖 ZIP 导出。标准 Vite/desktop build 使用正式打包路径且通过。

## Gate

**GO，仅限 Layer Package v1 PNG 编辑器集成。** 依据为真实菜单入口/原生选择器证据、正式编辑路径像素与结构断言、异常保护及可保存性。没有批准 Agent Canary、MCP、自动分割、任意素材格式或完整 Windows 发布验收。
