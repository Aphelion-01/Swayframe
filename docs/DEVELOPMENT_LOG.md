# V0.2 开发与验证记录

执行范围：Phase A→I，按阶段完成模型、画布、动画、曲线、路径文字、遮罩效果、结构编辑、平面三维与导出。各阶段完成后独立运行 typecheck/lint/tests/build，原始日志保存在 outputs/quality。

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| A 模型 / 命令 / 历史 | 完成 | 18 文件 / 71 测试；[门禁记录](../outputs/quality/Phase_A.log) |
| B 画布 / 变换 | 完成 | 19 文件 / 72 测试；[门禁记录](../outputs/quality/Phase_B.log) |
| C 时间轴 / 动画 | 完成 | 20 文件 / 74 测试；[门禁记录](../outputs/quality/Phase_C.log) |
| D 曲线编辑 | 完成 | 22 文件 / 77 测试；[门禁记录](../outputs/quality/Phase_D.log) |
| E 图形 / 文字 / 路径 | 完成 | 24 文件 / 80 测试；[门禁记录](../outputs/quality/Phase_E.log) |
| F 遮罩 / 效果 / 颜色 | 完成 | 26 文件 / 83 测试；[门禁记录](../outputs/quality/Phase_F.log) |
| G 预合成 / 父级 / 时间编辑 | 完成 | 27 文件 / 85 测试；[门禁记录](../outputs/quality/Phase_G.log) |
| H 平面 3D / 摄像机 | 完成 | 28 文件 / 87 测试；[门禁记录](../outputs/quality/Phase_H.log) |
| I 导入 / 导出 / 性能 | 完成 | 30 文件 / 91 测试；[门禁记录](../outputs/quality/Phase_I.log) |

实际交互发现并修复：曲线播放头线遮挡出切线（装饰 SVG 线禁止接收指针事件）；父级坐标下拖动偏移（逆矩阵换算）；同时选择父子导致重复移动（仅变换选中根）；父级更换只重定位静态值（同步 baseValue 和全部关键帧）；三维手柄预览未重新投影（从临时变换创建渲染快照）。每笔拖动仅提交一次历史，撤销精确恢复。对应自动测试和真实拖动均完成。

最后交互回归包括入/出曲线切线拖动、画布缩放与旋转；CASE01～11 包含保存重开和实际 PNG 下载。工程模型不持久化预览与历史。导出和预览共用渲染器。详细独立证据见 outputs/MOTION_EDITOR_ACCEPTANCE.md。范围边界见 DEVELOPMENT_BLOCKERS.md。

## Motion Curve System M1～M10

| 阶段 | 状态 | 验证 |
| --- | --- | --- |
| M1 Cubic Bezier 数学与求逆 | 完成 | 94 项测试；[原始门禁](../outputs/quality/M1.log) |
| M2 MotionCurve 模型与区间适配 | 完成 | 96 项测试；[原始门禁](../outputs/quality/M2.log) |
| M3 动画引擎与空间路径 | 完成 | 98 项测试；[原始门禁](../outputs/quality/M3.log) |
| M4 共享命令 / Undo | 完成 | 100 项测试；[原始门禁](../outputs/quality/M4.log) |
| M5 标准化曲线 UI | 完成 | 100 项测试；[原始门禁](../outputs/quality/M5.log) |
| M6 实时预览 | 完成 | 101 项测试；[原始门禁](../outputs/quality/M6.log) |
| M7 预设库 | 完成 | 104 项测试；[原始门禁](../outputs/quality/M7.log) |
| M8 时间轴 / Mixed | 完成 | 105 项测试；[原始门禁](../outputs/quality/M8.log) |
| M9 真实速度图 | 完成 | 107 项测试；[原始门禁](../outputs/quality/M9.log) |
| M10 复制粘贴 / 反转 / 多选 | 完成 | 112 项测试；[原始门禁](../outputs/quality/M10.log) |

按照数学→数据→求值→命令→UI→预览→预设→时间轴→速度图→操作顺序实施。112 项自动测试和 9 个 GUI 场景通过。修复退化贝塞尔起点速度、负向数值动画速度的符号、曲线路径速度换算、单侧预览显示与实际应用不一致、窄窗口面板最小宽度溢出。区间二分求值与预览结构共享保证拖动只更新受影响属性。

本地开发服务在验收前已恢复；无外部依赖阻塞。工程格式升级 0.3，旧文件 ID/曲线迁移保留。详见 outputs/MOTION_CURVE_ACCEPTANCE.md。

## 2026-10-03 — Workspace UI/UX 0.4

按 UX-1～UX-10 建立五区布局、工具系统、画布导航与选择、图层菜单、分组 Inspector、数字 scrub、分层 Timeline、Graph 内嵌、上下文快捷键与命令搜索。工程格式保持 0.3，GUI/Agent 数据修改路径保持 Command System，Intelligence 接口不变。阶段门禁保存 outputs/quality/UX-*.log；新增交互测试与浏览器证据独立记录，不以自动测试代替 GUI 验收。

## 2026-10-03 — Swayframe Desktop 0.5

D0 先完成 Repository Audit，保存迁移计划；随后严格 D1→D10 实施 Shell、窄 IPC、原生工程、生命周期、Linked Asset、原生菜单与布局、Recent/Recovery、PNG 文件与序列、打包及 QA。阶段门禁见 `outputs/quality/D0.log`～`D10.log`；D0 无 desktop build，其余包含桌面构建。

真实 macOS 窗口已测试 Shape/Text/两帧动画、Unicode 路径保存和重开、最近工程、dirty 关闭保护、撤销重做、图片导入、PNG 和序列。最终验收记录单独列出实测范围和 Windows/签名/Logo 缺口，不把交叉打包成功等同 Windows 实机通过。

QA 修复原生菜单缺少 Select All 导致数字输入追加、相对 CLI 工程路径启动失败、开发/产品 userData 混用、关闭前偏好写入竞争、并发保存，以及恢复窗口丢弃后遗漏启动工程。核心历史与动画行为保留原实现。

## 2026-10-03 — 属性 X/Y 链接

所有非颜色向量属性默认链接 X/Y，属性标题增加可切换链条按钮。位置、锚点和旋转采用同一增量；缩放采用原比例，零轴退回增量避免除零。三维 Z 独立，颜色分量不参与链接。链接偏好按 Property ID 存在 UI Preferences，不写 Scene、不产生历史。

输入与 scrub 共用同一向量更新；preview 保持瞬态，提交通过现有 valueCommand/Transaction；动画在当前时间生成一个向量关键帧，Undo 一次恢复两轴。新增交互测试覆盖默认链接、解除、比例、关键帧、预览取消、零缩放和 Z 独立。

## 2026-10-04 — Compositing Graph V0.1 / Swayframe 0.6.0

CG-0→CG-12 按顺序完成模型、注册表、共享命令、迁移、编译器、基础节点与 Merge/Mask、交互、参数动画、效果栈派生、缓存和 Agent 接口。每阶段包含 typecheck、lint、tests、Web build、desktop build，原始日志见 outputs/quality/CG-*.log。最终 62 个测试文件、165 项测试通过。

真实网页确认曝光像素改变、模糊边缘扩散及 0s/1s 的半径动画轨道。桌面发现并修复独立 userData 获取单实例锁过晚，以及严格 CSP 阻止内嵌图片 fetch 两个问题，增加回归测试。修复 evaluator 故障回退污染下游缓存、旧 Hue/Saturation 缺少明度参数，以及自动插入节点坐标重叠。最终安装包重新构建，测试与本机 GUI 证据分别记录，不把 Windows 交叉打包当实机验收。
