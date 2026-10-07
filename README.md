# Swayframe 0.9.15

本轮更新：统一 Feature / Command / Context / Contribution 注册机制，迁移工具栏、菜单、上下文、属性分区与搜索；效果和节点支持分类与关键词发现。详见 [0.9.15 验收记录](UX_ARCHITECTURE_RESULT.md)。

简体中文本地动效编辑器，支持人工完成 2D 与平面 3D 动画。当前节点模块基线为 `docs/baseline/COMPOSITING_GRAPH_CG0_CG12.txt`，桌面基线为 `docs/baseline/DESKTOP_D0_D10.txt`，前一轮编辑器基线为 `docs/baseline/MOTION_EDITOR_PHASE_A_I.txt`；历史 V0.1 基线保留用于追溯。

## 当前版本：全局信息架构

按用户任务整理七类应用菜单、Scene创建/对象右键、Inspector层级与时间/效果、动画上下文、节点入口、素材操作与可搜索命令。所有Scene修改复用Command/Transaction。后续UI改动先读根 `DESIGN.md` 与 `FEATURE_LOCATION_MATRIX.md`；本轮审计、实际验收与限制见 `UX_INFORMATION_ARCHITECTURE_RESULT.md`。

## 原生 AI Agent V1

本轮基线为 `docs/baseline/NATIVE_AI_AGENT_V1.txt`，已按 A0→A14 实施。创作助手使用原生 Provider、typed工具、共享Command/Transaction、真实低分辨率渲染与只读专业Proposal；设置入口为“文件 → 设置 → AI”。首次需配置服务地址、API Key、模型与能力，视觉检查需支持Vision的路由。未配置服务时不会伪装执行。开发Web凭证只存内存，正式密钥存储使用桌面版。

验收记录、限制及安装包见 `SWAYFRAME_AI_AGENT_V1_RESULT.md`。`agent-review.html` 为独立开发Mock协议页面，不进入生产入口。

## 启动与验证

需要 Node.js 22.12+，推荐 Node.js 24。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。运行 `node scripts/gate.mjs A14` 完成 typecheck、lint、tests、build；生产预览使用 `npm run build` 和 `npm run preview`。

## 桌面启动与打包

```sh
npm run desktop:dev
npm run desktop:build
npm run package:mac
npm run package:win
```

开发版使用独立 `outputs/desktop-dev-userdata`。产品偏好位于系统 Application Support/AppData 的 Swayframe 目录；可用 `SWAYFRAME_USER_DATA` 指定独立测试目录。安装输出位于 `release/`，macOS 为 `.app` / `.dmg`，Windows 为 NSIS `.exe`。当前包未签名，Logo 资源待提供；Windows 安装与运行尚未实机验证，详见 `DESKTOP_KNOWN_LIMITATIONS.md`。

桌面用原生对话框保存 `.swayframe`，图片保留外部路径引用，失联可重新链接。正式文件与自动恢复文件分离；导出 PNG 序列为文件夹。Web 开发入口及下载模式继续可用。

## 创作流程

创建合成后添加矩形、椭圆、多边形、星形、路径、文字、图片、纯色或空对象。图片可导入素材库并重复使用，也可拖到画布或时间轴。合成设置支持尺寸、帧率、时长和背景颜色。

画布支持移动、缩放、旋转及锚点编辑；默认移动自动记录位置关键帧。其他属性开启秒表后，在新的时间修改数值就生成关键帧。时间轴的菱形支持拖动、多选、复制粘贴与删除，图层时间条支持移动和修剪；图层可拆分，支持父级和预合成。

曲线编辑器提供值曲线、速度曲线、缓动预设及入/出切线。拖动手柄或编辑影响比例和速度时能预览，提交后可撤销。路径编辑器支持点与切线编辑；文字支持字号、字重、字距、行距和对齐。颜色可直接输入 HEX。

属性面板可添加动画遮罩、羽化、颜色调整、模糊、阴影等效果，调整效果顺序和混合模式。开启三维图层后可编辑 XYZ 位置、旋转、缩放和锚点；添加摄像机可动画控制位置、旋转和焦距。三维对象是透视投影的平面。

导出支持当前帧 PNG 和指定范围 PNG 序列 ZIP，使用与画布相同的渲染器。工程以 `.motion.json` 保存并严格校验，支持旧 0.1.0 文件迁移；浏览器自动保存仅作辅助。打开工程清空撤销历史。完整验收工程在 `outputs/examples/MotionEditor_CASE01_11.motion.json`。

Shift 多选；Cmd/Ctrl+Z 撤销，Shift+Cmd/Ctrl+Z 重做；中键或 Alt 拖动画布平移，Ctrl/Cmd 滚轮缩放。更多快捷键见 `outputs/BASIC_EDITOR_UPDATE.md`。

## 实现与范围

GUI 与 Agent 共用 Command System，批量操作通过 Transaction；Intelligence Service 只返回 Proposal，应用时才提交命令。现有智能辅助为确定性演示，不接真实模型服务。

GIF 作为静态图片；未提供视频解码、MP4 导出、完整三维建模、灯光、粒子、Tracking/Roto、复杂 Expressions 或 AE 插件兼容。父级非均匀缩放叠加旋转会产生剪切，重新指定父级时当前 TRS 模型只能近似重建该剪切；父级后续动画由真实矩阵继承。路径点数量不同的关键帧采用保持插值。

架构见 `docs/ARCHITECTURE.md`，格式见 `docs/PROJECT_FORMAT.md`，开发记录见 `docs/DEVELOPMENT_LOG.md`，阶段与真实 GUI 验收见 `outputs/MOTION_EDITOR_STATUS.md` 和 `outputs/MOTION_EDITOR_ACCEPTANCE.md`。

## Motion Curve System

在时间轴选中两个或多个相邻关键帧，点击“动画缓动”。拖动标准化 P1/P2 即时预览，松手提交一笔历史。可跨位置、缩放、透明度等多个属性统一应用，也可只编辑当前区间。提供双侧/出侧/入侧、反转、镜像、曲线复制粘贴及 29 个内置预设。自定义库支持跨工程保存、收藏、改名、删除、复制与最近使用。

原“曲线编辑器”保留真实速度图与精确速度/影响比例控制，空间路径在独立折叠区编辑。工程格式 0.3.0，兼容迁移旧 0.1/0.2 文件。API 和实现见 `docs/MOTION_CURVE_SYSTEM.md`，本轮验收工程为 `outputs/examples/MotionCurve_Validated.motion.json`，验收记录为 `outputs/MOTION_CURVE_ACCEPTANCE.md`。

## Compositing Graph

选择图层后，底部切换到“合成节点”，用“＋ 添加节点”或 Tab 搜索。默认 Source→Output；Exposure、Gaussian Blur 等自动插入连接，选中节点后在右侧调整参数、启用动画。空格拖动平移、滚轮以鼠标为中心缩放、F/Home 适应、Shift 多选、框选、Cmd/Ctrl+D 复制、Delete 删除；右键提供连接与节点操作。参数与时间轴/曲线共用，改一次可撤销，节点移动一次对应一次历史。

线性效果栈与节点图共享同一数据；存在分支时效果面板提示使用节点图。Merge 支持 A/B/Mask、覆盖/正片叠底/滤色/相加，Source 为前景、Solid 可作背景。工程保存 schema 0.6.0，兼容旧效果栈及0.5工程迁移。

验收示例位于 `outputs/compositing/`：source、linear、merge 与 legacy-effects.swayframe；运行 `node scripts/compositing-fixtures.mjs` 可重新生成。原始设计与验收分别见 `COMPOSITING_GRAPH_DESIGN.md` 和 `COMPOSITING_GRAPH_ACCEPTANCE.md`。当前产品包为 `release/Swayframe-0.6.3-arm64.dmg` 与 `release/Swayframe Setup 0.6.3.exe`。自主冲刺状态见 `DEV_SPRINT.md`。

## 自主冲刺 V2

画布增加边缘/中心吸附、临时参考线、Shift方向约束、Alt暂时关闭；二维图层拥有八方向缩放手柄，遵循属性X/Y链接，Alt围绕锚点，旋转Shift按15°调整。关键帧多选拖动限制在合成范围，支持吸附播放头和其他关键帧；取消播放头拖动会回到起始时刻。

双击文字直接输入多行，Enter换行、Cmd/Ctrl+Enter提交、Esc取消；中文输入法选字不会触发编辑器快捷键。值/速度曲线支持滚轮缩放、Space/中键平移和F适应，缩放后的切线编辑仍复用原关键帧系统。

完整验收工程：`outputs/sprint-v2/full-workflow.swayframe`。冲刺结果与限制见 `SPRINT_RESULT.md`；运行 `npm run benchmark` 查看CPU求值基准，范围见 `outputs/performance/README.md`。

## 实时数值编辑（0.6.2）

直接在属性数值上向上拖动增大、向下拖动减小；Shift 大步长、Alt 小步长，点击可输入。输入和方向键立即预览，松手或 Enter 提交，Esc 取消。链接的 X/Y 数值同步预览，每次编辑仅一条历史；非 X/Y 数值、颜色和四分量区域不显示链接按钮。原属性名称的横向拖动继续可用。验收见 outputs/NUMERIC_EDIT_UPDATE.md。

## Optimization & Polish（0.6.3）

本轮停止大型功能扩张，完成真实创作流程、快速缩放修复、静态时间轴/按层求值缓存、图布局渲染隔离、稳定取消监听、面板订阅缩减及另存为/序列化优化。204 tests，全质量门禁通过。

结果与边界见 `OPTIMIZATION_RESULT.md`；实际测量、原生 A/B round-trip 和截图见 `outputs/optimization/`。开发服务器打开 `/benchmark.html`，点击“运行性能基准”可复测 BENCH-A～D；开发Profiler数值不等同于发行版性能。工程仍只由 Command/Transaction 修改。

## Full UI/UX Redesign（0.7.0）

统一中性暗色、16px SVG 图标与紧凑控制体系。上方全局菜单/工具栏，左侧项目/图层/助手，中央画布，右侧属性，下方时间轴/曲线/节点；面板尺寸与折叠仍独立保存。属性数值继续实时预览和纵向拖动，X/Y 链接只出现于向量。助手切换保留草稿与 Proposal，不占据常驻聊天区。

三个改造批次全门禁通过，最终76文件/209 tests。macOS arm64原生保存重开严格一致，0.5秒PNG与0.6.3验收帧字节一致；Windows x64只完成交叉打包。审查与限制见 `docs/ui-redesign/RESULT.md`，真实截图和验证数据见 `outputs/ui-redesign/`。开发环境 `/ui-review.html` 可用真实编辑器检查五种窗口尺寸，不进入产品入口。

本轮新增独立轴向与支点控制、二维多选变换、可拖动自定义支点、可见行条纹与持久图层色标。工程格式0.6.0兼容旧版本；变换偏好只存工作区。执行基线和阶段记录见 `docs/transform-readability/`；`transform-review.html` 为独立开发验收入口。
