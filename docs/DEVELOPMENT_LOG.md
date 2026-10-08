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


## 2026-10-04 — 高强度自主冲刺 V2 / Swayframe 0.6.1

V2-1～V2-10 按高价值顺序完成连续交互保护、Canvas 吸附、Timeline 范围/吸附、八方向缩放、多行文字和 IME、值/速度图视口、CPU 求值优化、完整工程与桌面发布、默认图直接绘制、原生最终 QA。沿用 Command/Transaction/Property/Graph；未重写架构。阶段日志见 outputs/quality/V2-*.log。新增 21 项核心与交互回归，最终 71 文件 / 186 tests。

500 层 / 50000 关键帧的核心 CPU 求值中位数优化约 8～13 倍，校验值一致；不代表浏览器端整体 FPS。无效果不透明图层减少离屏绘制，半透明与混合保留原组语义。独立最终 macOS app 实测完整工程显示、0.5s 动画、文字一次 Undo/Redo、原生保存重开及三帧 PNG；磁盘除了指定文字内容其余数据一致，单帧与序列首帧像素相同。两平台包成功构建；Windows、签名与 Logo 仍按边界记录。结果见 SPRINT_RESULT.md 和 outputs/sprint-v2/QA.md。


## 2026-10-04 — 实时数值编辑 / Swayframe 0.6.2

按用户反馈仅保留 Vec2 / 三分量向量的 XY 链接，标量、颜色、四分量区域和路径不显示链接图标且不联动。NumberField 数值支持纵向拖动，原标签横向拖动保留；输入/方向键实时预览，点击输入、Enter/松手提交、Esc/失焦/捕获丢失取消。联动轴同步显示。文字字号、几何、时间范围、摄像机和两类曲线/空间路径均使用预览适配，最终提交仍为共享 Command。新增六项测试，覆盖100次移动一条历史、实时输入与链接显示、边界/取消/过期、几何字号预览、无效图标；全门禁192项通过。网页实测旋转输入25°时焦点仍在输入且画布更新，向上拖30px提交30°，一次Undo恢复0°。调整既有遮罩测试，把外部时间更新放入act，避免将旧React快照当新输入时刻。证据见 outputs/numeric-edit/。


## 2026-10-06 — 顶部常驻与多供应商 / 0.9.1

左面板标签栏移出滚动容器，项目/图层/助手标题在内容滚动区顶部固定；助手内容保持挂载。实际浏览器助手滚动231px，标签top=101px、标题top=133px均保持不变。供应商选择新增DeepSeek、硅基流动、OpenRouter、自定义兼容服务；按官方地址预填，模型ID保持可编辑。DeepSeek预设deepseek-flash/deepseek-v4-pro；官方默认thinking模式不支持指定工具选择，统一兼容请求显式禁用thinking，保留现有Command/Transaction闭环。更改供应商地址origin要求重新输入密钥，不沿用其他服务的密钥。

新增供应商切换/密钥保护及DeepSeek请求回归，98文件/288 tests、lint/typecheck/Web build/desktop build通过。浏览器截图见outputs/ui-provider-fix。供应商响应以受控传输测试验证；未使用真实用户密钥调用第三方服务。

## 2026-10-06 — 输入保护与操作反馈 / Swayframe 0.9.2

修复静态文字被拖选；保留输入框编辑和原对象框选。参考图支持区域拖入和剪贴板图片，三种入口复用导入器，显示缩略图并阻止误入Scene。参考发送检查vision路由和凭证；不支持识图时给出可操作提示；任务失败和取消保留需求，成功后清空原提交草稿。画布增加真实轴向/支点说明和视觉标记，个别中心保留独立支点，自定义可拖动。

新增失败保留/文字重试/参考隔离/多支点视觉反馈回归。实际浏览器验证截图粘贴生成参考缩略图、静态标题拖动没有文字选择、输入框仍可编辑；不同模式显示对应控制轴和支点。完整门禁及安装包结果见outputs/interaction-ai-fix/verification.json；未调用真实付费模型。

## 2026-10-06 — Transform Guidance System / Swayframe 0.9.3

移除对象附近模式名称和持续完整参考圈；角落保留小状态标记。新增双环支点、不同形状的锚点、真正Global/Local控制轴、Scale扩张箭头、Rotation短弧和实时角度、外部支点虚线、受控Ghost轮廓。Inspector九宫格与来源按钮支持悬停/焦点预览，方向键只导航九宫格，不误移动图层。Hover不改工程，Custom Pivot连续拖动一次Undo，参考设置与Scene共用历史顺序但不进入工程。

CASE 1～8以真实变换数学和UI交互回归验证；实际浏览器观察底部固定预览、左上旋转32.4°、全局/局部轴以及Custom Pivot外部连接。完整质量门禁、安装包内容一致性与视觉证据记录于outputs/transform-guidance。未增加动画数据重映射、Skew或Camera功能。


## 2026-10-07 — V0.2 创作闭环专项 / Swayframe 0.9.4

初始真实界面审计发现Web新建无效果、缺少合成名称、零缩放阻断作品A；修复上述问题和默认静态误录关键帧，完善加载状态清理以及产品版本显示。新增14项集成/UI/共享Renderer调用测试，102文件/315tests、typecheck及Web/desktop build通过。作品A/B/C均通过普通浏览器控件创建，A播放/属性Undo、B路径/羽化/模糊轨道和删除撤销、C摄像机推进实测。没有扩功能或注入工程状态。

Mac锁屏阻止继续原生文件对话框和鼠标操作；已请求解锁。浏览器下载接口无文件路径，因此原生Save→Close→Reopen和真实PNG序列像素抽查仍待验收，本轮不能整体标记完成。完整结果见V0.2_WORKFLOW_RESULT.md及WORKFLOW_AUDIT.md。

## 2026-10-07 — 解锁后原生闭环 / Swayframe 0.9.5

用户解锁后，以独立桌面配置重建并保存作品 A，真正退出应用后重开、播放、修改和撤销；完整工程 JSON 相等。实测播放头与 Canvas 移动/缩放/旋转。发现关键帧按钮丢失末次释放，改为窗口捕获完整手势，释放时采样坐标；真实 1→1.5 秒拖动一次 Undo 恢复。新增回归，全量 102 文件 / 316 tests、lint 通过。

原生 0.9.4 导出 150 张 1920×1080 PNG，首/中/末单帧与序列解码 RGBA 相等；最终 0.9.5 缩放峰值单帧也与序列第 15 帧相等，Renderer 未变。原生验收记录见 outputs/workflow-v02/native-acceptance.json；B/C 原生完整输出及 Windows 实机仍未验证。

## 2026-10-07 — 品牌图标 / Swayframe 0.9.6

按用户参考图替换应用图标与顶部字标；使用 imagegen 分离品牌资源，Sway 字段适配深色界面为浅灰，frame 保持蓝色。原图未覆盖。PNG 转换为标准多尺寸 ICNS/ICO，electron-builder 使用真实图标，网页 favicon 同步更新；字标保留 alt 文本和原文件菜单交互。浏览器 1280×720 实测字标清晰、完整、无裁切，截图 outputs/branding/editor-branding.jpg。全量 316 tests、lint、typecheck、Web/desktop build 通过；macOS 包内 ICNS 与源文件相同。

## 2026-10-07 — 专业 Proposal 约束修复 / Swayframe 0.9.7

顶部字标由 124×26 调整为 104×22。定位到 IntelligenceService 对外使用最多100步的通用Plan schema，内部却最多12步且不允许范围外工具；模型未预先获知同一约束，错误直接终止。现为专业Proposal生成匹配12步上限、当前工具名及各工具参数的JSON Schema，并明确不支持能力须说明可编辑近似方案。无效响应最多自动纠正一次；仍失败时分别显示格式、步数或不可用工具名称，取消/传输异常不重试。不放宽权限、无新增工具，Proposal仍只读，实际执行继续通过Registry校验和共享Transaction。新增上限与schema、超限纠正、越权拒绝和取消回归；全量102文件/319tests、lint及Web/desktop build通过。视觉证据outputs/proposal-fix/editor.jpg。未调用用户付费模型，真实供应商响应仍须用户复测；本修复不新增形状布尔融合/液态融合能力。

### 2026-10-07 · 0.9.8 Canvas Interaction

执行 `V02_CANVAS_INTERACTION.txt`，完成审计、互斥Pointer交互、共享坐标、边界外框选/锁定命中、连续旋转、单轴/等比缩放、Alt复制Transaction、实时Inspector/Mixed、真实倍率/resize、hover/角外旋转、预合成返回、repeat微调合并及基础等间距引导。A～G及父级锚点等专项测试通过；实际浏览器验证鼠标拖动、Undo、单轴缩放、90°旋转、Hand平移和真实倍率。完整门禁、安装包校验及限制见CANVAS_UX_RESULT.md与outputs/canvas-ux/verification.json。本轮没有扩展Timeline、AI、Effects或高级3D。

## 2026-10-07 · 0.9.9 Timeline / Keyframe Editing

以V02_TIMELINE_INTERACTION为本轮基线，先审计再完成树结构、列宽/冻结、过滤、动态刻度、关键帧手势与单步Undo、跨属性粘贴、Graph往返和已有Span操作。真实UI验证额外发现框选未同步Layer、原生HTML拖放不稳定、Pointer捕获阻断双击；分别修复选区同步、统一Pointer排序和label双击入口，并补回归。播放头索引和CSS拖动预览保持轨道DOM，100层/500及1000帧压力测试通过。完整门禁106文件/379测试通过；安装包0.9.9单独核对归档构建一致性。浏览器下载事件超时、真实FPS和Windows运行边界写入结果，不以截图或测试PASS替代。

## 2026-10-07 · 0.9.10 用户问题修复

根据 0.9.7 的 6 项问题和 5 项要求，基于 0.9.9 完成连续绘制、属性/曲线可靠释放、钢笔贝塞尔与路径外观、图层框选、曲线比例/越界手柄/播放、身份色标及右键创建饼菜单。额外修复速度数值编辑会重算另一端切线的问题。完整门禁107文件/388测试通过；实际浏览器验证见 outputs/editor-bugfix-0910。大窗口截图后端存在裁切，单列 DOM 与视觉验证边界；桌面包一致性和平台运行限制记录于 EDITOR_BUGFIX_0910.md 与 verification.json。

## 2026-10-07 · 0.9.11 Graph Editor UX

按 V02_GRAPH_EDITOR_UX 执行专门布局重构：取消固定曲线宽度/宽高比，统一 Graph 与标准化缓动 dock、32px工具栏、250px可折叠/拖宽属性栏和36px预览栏；Timeline过滤与播放控件按模式隐藏。增加按key/segment/handle的精确参数上下文，修正中间帧入/出区间归属及数组值编辑，Motion右键精确传递区间；选择、时间、播放和Command共用原系统。108文件/397测试通过，包含两个曲线视图200次预览与窗口释放一次Undo。真实浏览器验证四尺寸、折叠/拖宽、播放、曲线修改与Undo（位置50→34.919→50）。详见GRAPH_EDITOR_UX_RESULT.md和outputs/graph-editor-ux。


## 2026-10-07 · 0.9.12 Global Information Architecture

执行INFORMATION_ARCHITECTURE基线，审查并通过官方installer安装ux-heuristics/design-system；ui-ux-design地址404，记录失败而继续。扫描87文件/442基线代码入口，建立根DESIGN/Matrix/Audit/Result及AGENTS放置规则。实际迁移七菜单、对象右键/显式创建、Inspector层级时间和Effects、搜索、属性/素材上下文、原生动作适配；移除重复播放与Timeline杂项菜单。复审修复窄窗口菜单裁切、节点Edit误操作图层风险和graphSelection订阅。109文件/411测试、lint/typecheck/Web及desktop build通过；独立浏览器完成10任务入口验证、四桌面尺寸与650px窄窗口。导出状态完成但浏览器下载事件超时，未验证本轮文件落盘；原生平台运行边界与启发式评估限制详见根结果文档。

## 2026-10-08 · 0.9.17

完成用户 12 项创作体验专项改动；执行与限制见 EDITOR_POLISH_RESULT.md。注册 canvas-aids / text-animator / spatial-translate / spatial-rotate，未新增全局工具栏按钮。保留共享 Command/Transaction、Proposal 边界，更新入口库存与位置矩阵。新增实时光学、文本范围动画、输出采样/取消、路径直接操控和帧缓存预算回归。

## 2026-10-08 — V0.3 Unified Effect Engine

按 Phase0→Phase7 顺序推进：真实架构审计；十项内置效果兼容注册；统一浏览器和独立预设；径向渐变共用算法；受控声明式 CPU Runtime；自包含版本库和草稿生命周期；Agent Forge工具；集成与实际Canvas验收。阶段测试数量依次为466、468、469、472、476、479、481，最终结果见 EFFECT_ENGINE_TEST_REPORT.md。真实浏览器逐像素验证 Fill/Generator/Graph、预览/PNG导出、重开及关键帧；优化1080p渐变运算从约583ms到6.4ms。该结果仅是本机单次基准，不能推广为复杂自定义效果实时帧率。

## 2026-10-09 — Effect Runtime 性能优化

保持 declarative-pixel-v1 和共享渲染路径，编译固定操作码、移除不可达指令、复用帧/行/列计算，列缓存最多8MiB。冻结旧标量解释器作为独立对照，覆盖全部25条指令、80个确定性混合程序、非有限中间值、窄宽图像与缓存超限回退。130文件/514测试、lint、typecheck和Web/桌面构建通过。真实浏览器1080p有机纹理中位约1792ms→95ms、逐像素一致；仍不承诺实时播放。无用户入口或Scene数据变更。详见 EFFECT_RUNTIME_PERFORMANCE_RESULT.md。
