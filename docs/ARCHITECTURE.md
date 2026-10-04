# V0.1 架构

唯一执行基线：`docs/baseline/Codex_第一阶段开发任务书_V0.1_重新输出.docx`。正文提取与 SHA-256 同目录保存。用户已授权按 T0 → T10 顺序连续实施全部任务。

## 不可违反的约束

- C-01 Single Mutation Path：工程状态只由 Command/Transaction 修改。
- C-02 Shared Command API：GUI、快捷键、Agent 共用命令，不设特殊写入通道。
- C-03 Model/UI Separation：核心不导入 React、DOM 或 Canvas。
- C-04 Deterministic Core：Project 与时间相同，求值与渲染输入相同。
- C-05 Stable Identity：实体和命令/事务使用持久化 UUID。
- C-06 Time in Seconds：核心统一使用秒，帧只在 UI 边界转换。
- C-07 Proposal before Mutation：Intelligence 仅输出 Proposal，验证并转换为命令后执行。
- C-08 Renderer Adapter：Renderer 单向读取快照，Canvas 对象不进入模型。
- C-09 Versioned Project Format：保存包含 schemaVersion，加载经过 migrateProject。
- C-10 No Premature Native Core：V0.1 使用 TypeScript，无 Rust/C++ 核心。

## 模块边界

`core-types` → `project-model` → `animation-engine` / `command-system` / `project-io`。

`renderer-core` 读取模型与动画求值结果，定义平台无关快照/适配器协议；`renderers/canvas2d` 是 DOM/Canvas 实现。

`agent-contracts` 将工具调用转换为共享命令；`intelligence-contracts` 仅返回 Proposal。二者通过 Command/Transaction 应用。

`ui` 订阅编辑器 Store。选择、播放时间、缩放、拖动预览是 UI state；业务更新入口为 executeTransaction。Store 对外提供只读、深度冻结的快照。Transaction 经严格运行时 schema 校验；在临时工程完整执行和校验后才一次提交，失败不产生部分修改。工程替换使用系统命令，成功加载后清空历史。

## 范围

P0：四类图层、Transform/Property/Keyframe、Linear/Bezier/Spring、Canvas/Layer/Inspector/Timeline、History、JSON IO、最小 Mock Agent 与 Mock Advisor 闭环。

禁止：3D、复杂 Mask/Effects/Blend、Particles、Tracking、Roto、GPU Render Graph、Rust 原生核心、完整媒体管线、生成式模型、模型训练、插件市场、协作、账户、支付、Expression 运行时。

每阶段质量门禁记录到 `outputs/quality/`。架构变化先写 ADR；阶段与验收状态见 `outputs/EXECUTION_STATUS.md`。

## 集成实现

拖拽使用独立预览，结束通过 editPropertyCommand 提交一笔事务；已有动画的属性更新当前时间关键帧。Agent 批量调用和 Proposal 转换在隔离的 CommandSystem 中预验证，再向真实工程提交同样的共享命令。Proposal 过期后拒绝应用。Renderer 图片缓存跟随 assets 生命周期释放，不保存业务状态。

自动保存只响应工程快照变化，播放头不触发保存。UTF-8 工程文件上限在保存和加载两侧校验。History 不持久化。监听器异常与浏览器存储失败不回滚已成功提交的工程，分别报告错误。核心不依赖具体渲染器或浏览器对象。

T10 的静态架构检查、集成测试和真实浏览器验收已完成，详见 outputs/EXECUTION_STATUS.md。

## 用户授权的基础编辑扩展

`core/editing-commands` 将自动关键帧、属性动画开关、图层克隆、关键帧批量移动与粘贴转为共享数据命令。操作末尾由 CommandSystem 一次校验并提交，冲突不产生部分写入。克隆重建 Layer/Property/Keyframe ID，图片引用保持素材关联。

EditorStore 管理图层/关键帧选择、剪贴板、自动记录开关与筛选/缩放。批量画布拖动和关键帧拖动仅更新预览，松手提交一笔 Transaction；工程变化时取消预览。Renderer 读取多图层预览，模型中不存 UI 状态。具体功能、验证和快捷键见 outputs/BASIC_EDITOR_UPDATE.md。

## 当前用户授权范围（覆盖上面的历史范围）

最新执行基线为 `docs/baseline/MOTION_EDITOR_PHASE_A_I.txt`，按 Phase A → I 推进，允许 Graph Editor、基础 Mask/Blend/Effects、Precomp、平面 3D/Camera 和 PNG Sequence。禁止完整建模、粒子、Tracking/Roto、高级抠像、复杂 Expressions、AE 插件兼容及大型 AI。设计决定见 `docs/DECISIONS/0002-editor-extension.md`。

0.2.0 延续 Transform，新增 Layer.editor 的可动画属性、遮罩和效果栈。属性查询遍历属性容器；UI 结构不会决定核心属性的可写范围。layer.replace 与 composition 命令使用目标粒度逆操作。原版本静态 fill/fontSize 保留兼容，存在 editor 的可动画属性时以该属性为准。迁移和提交均进行严格校验。

## 0.2 编辑与渲染实现

GraphEditor、PathEditor 和画布手柄在拖动时仅写 UI 预览；松手调用共享 Command System 提交一笔 Transaction。变换提交由 transform-editing 统一构造；父级下的拖动通过矩阵逆变换换算局部坐标，多选父子只移动选中根节点。删除父级会在同一事务中解除未删除子级关系；克隆父子重建引用。

Animation Engine 对所有 Property 统一求值，冻结 Property 的排序关键帧通过 WeakMap 缓存。renderer-core 计算时间范围、二维父级矩阵、三维世界矩阵和摄像机投影，冻结合成的帧快照缓存最多 16 帧。位图缓存跟随素材生命周期，局部效果表面按工程、时间和素材版本失效。

draw-content 绘制图形、路径、文字和素材；layer-compositing 在局部离屏表面按顺序处理遮罩与效果，颜色效果处理实际 RGBA 像素，Canvas 模糊与合成处理空间效果。二维层使用仿射矩阵，三维层通过 12×12 网格的三角形 UV 映射投影平面。近裁剪面后方的平面不绘制；不提供实体建模或灯光。

预合成递归使用同一 Canvas Renderer。png-export 在冻结的工程快照上按帧求值，同一渲染器输出无选择框 PNG；zip-archive 写入帧文件、CRC32 与 manifest。导出支持取消，分段让出浏览器主线程；不存在仅对预览生效的 CSS 效果。

parentCommands 重定向当前父级关系时同步变换 baseValue 与所有已有关键帧。TRS 无独立剪切参数，对带旋转的非均匀缩放重定向有近似限制。跨预合成边界的父子引用要求一起选择，校验失败保持工程和历史原状。

Phase A～I 门禁和 CASE01～11 的真实 GUI 操作证据见 outputs/MOTION_EDITOR_STATUS.md、outputs/motion-editor-browser-acceptance.json。PNG 下载、保存重开和序列首帧一致性由独立文件校验补充，不以测试退出码替代功能验收。

## 当前 Motion Curve System（M1～M10）

新增执行基线：docs/baseline/MOTION_CURVE_M1_M10.txt。MotionCurve 是标准化 API，适配原有关键帧 outgoing/incoming，区间命令通过现有 Transaction 提交。Curve Panel 与专业 Speed Graph 操作同一数据体系，空间路径单独保存，不受缓动命令修改。

工程格式升级 0.3.0，旧 0.1/0.2 文件迁移保留已有实体 ID。曲线预设库独立于工程持久化；Intelligence 可推荐曲线，Agent 通过 MotionCurveAPI 应用共享命令。核心模块不依赖浏览器存储，存储由 UI 注入。

临时预览仅复制受影响属性的容器路径、保留无关图层引用；曲线求值缓存有界，关键帧排序由不可变快照缓存，区间二分定位。完整 API、数学与速度转换约定见 docs/MOTION_CURVE_SYSTEM.md；门禁与 GUI 证据见 outputs/MOTION_CURVE_ACCEPTANCE.md。

## Workspace UI / UX（UX-1～UX-10）

执行基线 `docs/baseline/UI_UX_UX1_UX10.txt`。应用版本 0.4.0，Project schema 保持 0.3.0，不修改持久化模型。

`ui/workspace` 提供设计组件、Tool Context、FocusContext / Shortcut Registry、Command Palette、统一取消信号与独立布局持久化。五区布局只持有面板偏好；图层、关键帧、效果操作继续通过 EditorStore → CommandSystem。菜单、快捷键和搜索入口调用同一操作。

NumericField 连续拖动仅向渲染快照写属性预览，松手提交一笔 Transaction。Property 或时间变化后拒绝提交过期 scrub。画布创建、钢笔多点、框选、变换以及时间轴拖动皆不在过程中写入正式 Project。Escape 通过 `motion:cancel` 通知各交互组件取消；布局拖动恢复 UI 尺寸，业务预览清空，历史不增加。

Timeline 默认折叠未选图层；选择时展开并定位，动画属性旁使用秒表/菱形。Graph 与轨道共享底部工作区，通过 tabs 替代显示，Motion Curve 保持独立。时间轴缩放在真实时间与滚动坐标之间转换，补偿鼠标或播放头位置；Canvas 缩放以画布实际边界校正鼠标中心。

质量记录见 `outputs/quality/UX-1.log` ～ `UX-10.log`，UI/UX 验收见 `outputs/UI_UX_ACCEPTANCE.md`。

## Swayframe Desktop 0.5（D0～D10）

执行基线 `docs/baseline/DESKTOP_D0_D10.txt`。既有 React/TypeScript 编辑器与 Canvas2DRenderer 保留。`src/desktop` 提供平台无关 DesktopAPI、DesktopService、ProjectService、素材服务、恢复调度和启动界面；`apps/desktop/electron` 提供 main、sandbox preload、IPC、菜单、文件和持久化。单一 `ProductMetadata` 生成打包元数据。

React 不导入 Electron/Node，不知道 IPC channel；preload 只暴露有类型的业务方法。Main 校验 sender/mainFrame、Zod 合同、授权路径和数据上限。contextIsolation 开启、nodeIntegration 关闭、sandbox 开启，禁止外部导航、新窗口及 webview，限制 CSP。图片通过授权不透明 token 访问；协议再次验证文件大小与图片签名，阻止文本伪装图片和符号链接读取非图片内容。

工程格式 0.4.0 在既有 Asset 上增加可选 linked source；0.1/0.2/0.3 migration 保留实体 ID。原内嵌素材仍兼容。导入素材与创建图层作为同一 Transaction；Relink 用 asset.replace 保持 Asset/Layer ID，支持 Undo/Redo。GUI、菜单、快捷键和 Agent 的 Scene 修改仍走 EditorStore→CommandSystem。

ProjectService 对 committed snapshot 比较 dirty；并发保存合并，保存过程中继续修改仍保持 dirty。New/Open/Close 共用 Save/Don't Save/Cancel；正式文件通过异步临时文件原子替换，失败保留 dirty。Recovery 单独持久化、提交后 debounce，不覆盖正式文件；恢复版本作为 dirty 工程加载。恢复窗口优先，丢弃后继续处理启动文件。

窗口边界、最大化、面板尺寸/折叠、最后 tab 是 User Preferences，不进入 Scene；窗口正常关闭前等待偏好落盘，离屏窗口重新约束。Recent 缺失项保留并标注，可移除。日志按 Main、Renderer、IPC、FileIO、Project、Export 分类。

PNG 与逐帧图像继续由原 Renderer 生成；ZIP/CRC 在 Web Worker，桌面序列解包和磁盘写入在 Node Worker。原生序列输出 PNG 文件夹和 manifest，Web 保留 ZIP 下载。NativeCore/MediaService 只有接口预留，不实现新编码器、AI 或渲染架构。

## Compositing Graph V0.1 / Swayframe 0.6

执行基线 `docs/baseline/COMPOSITING_GRAPH_CG0_CG12.txt`。Project schema 0.5.0，graph.version 1。Layer.editor.graph 持久化 Node/Port/Edge、Property 参数、owner 与布局。旧效果栈仅作为迁移输入，迁移删除 effects，效果 Inspector 从线性图派生；分支图不能误当线性效果栈改写。

core/compositing-graph、registry、operations、compiler、cache、service 与 tools 不依赖 DOM。注册表统一定义端口、参数和 evaluator，CanvasGraphBackend 提供真实像素实现。编译器只处理 Output 的依赖闭包、按拓扑执行；单输入限流、端口类型、循环、唯一固定节点、全局 ID 与 owner 由模型/命令校验。编辑中缺少输入可保留，编译报告诊断，渲染在故障节点旁路并显示错误；失败输出不缓存，以便后续恢复。

现有图层遮罩在生成 Source 时应用，保留旧工程语义。Mask 节点生成局部矩形/椭圆覆盖，Merge 的 Mask 只限制 A 前景。Merge 使用真实 RGBA 合成，实现 Over/Multiply/Screen/Add。Exposure/Color/Blur 复用既有渲染算法；节点 Transform 使用局部矩阵。Canvas 预览、PNG 和桌面序列导出共用同一渲染入口。内嵌图片直接解码 data URL 成 Blob，避免桌面 CSP 阻止 fetch(data:)；Linked Asset 继续通过授权协议读取。

图修改通过 graph.replace 和现有属性/关键帧命令进入共享 CommandSystem。创建与重连一次 Transaction，连续拖动只有 UI 预览，松手提交一次，Escape 取消。Inspector、Timeline、Value/Speed Graph 和 Motion Curve 共用 Property(t)，没有节点专用动画模型。CompositingGraphService/AgentBridge 结构化接口共享命令并支持隔离预验证的批量事务，Intelligence 仍只输出 Proposal。

节点像素签名排除坐标、名称与 metadata。参数变化只失效自身及下游，源变化传播依赖。每层节点缓存最多 64 项/32 MB，最多保留 4 个图层源表面，源表面总量最多 32 MB；缓存别名不重复计字节，删除节点清理，像素逐出后保留签名版本。该上限不包含当前帧临时工作表面。默认最少 128px padding 保持常用模糊参数调整的 Source 尺寸稳定，超过已有 padding 的空间效果会重建 Source。

节点视口与选择只属于 UI Preferences，节点坐标属于工程但不影响像素。单实例锁在指定 userData 后获取，独立测试 profile 不再转发工程到用户旧版本窗口。CG 阶段门禁和自动测试/真实 GUI 的证据边界见 COMPOSITING_GRAPH_ACCEPTANCE.md。

## 自主冲刺 V2 / Swayframe 0.6.1

执行基线 `docs/baseline/DEV_SPRINT_V2.txt`，Project schema 保持0.5.0。拖动控制器捕获工程与播放头时间，过期手势不能写到其他时刻；共享取消钩子同时处理Escape与窗口失焦。Canvas/Timeline吸附仅调整预览输入，松手仍提交原Command/Transaction。参考线与视口不持久化到Scene，移动/缩放/关键帧批量交互保持一次历史。

八方向缩放使用原世界逆矩阵，围绕相对边/角或锚点计算。X/Y链接偏好复用属性面板存储。父级子层按原局部缩放与世界缩放的增量比例转换，避免负缩放符号被世界矩阵分解丢失。选择手柄大小由屏幕比例传给Renderer，不影响导出内容。

TextField统一支持多行和自动聚焦，中文输入法事件由字段和Shortcut Registry共同保护。Value/Speed Graph视口仅属UI，切线拖动反算当前视口且固定本次手势的轴范围；空间路径字段仍不改变。

帧求值使用父级ID索引，world3D只计算投影图层及祖先，摄像机视图每帧复用。默认不透明、正常混合的Source→Output图层直接绘制；含遮罩、效果、半透明、其他混合、预合成和3D仍走原离屏路径，避免改变组语义。CPU基准与Canvas分配回归单独记录，不以CPU基准等同实际预览帧率。

### 数值实时预览（0.6.2）

NumberField 捕获编辑起始值、revision/time，输入和纵向拖动使用瞬态预览；即使曲线界面将当前值更新为预览值，提交仍和起始值比较，防止漏写命令。Enter/blur 或松手仅提交一次，取消、捕获丢失与过期不写工程。AnimatedField 联动轴只在真实2/3分量向量启用，预览显示和持久数据分离。非动画几何使用 EditorStore.setLayerPreview 的局部不可变渲染快照，持久化仍由原 layer.replace / layer.patch Command 完成，不新增动画或历史系统。

## Optimization & Polish / OP-1～OP-2

执行基线 `docs/baseline/OPTIMIZATION_POLISH.txt`。停止大型模块扩张；真实原生流程、Optimization Backlog 和 Performance API/React Profiler 证据驱动小批次修复。

Canvas 手柄瞬态预览同时持有同步引用与 React 显示状态；松手读取同步引用，避免同批 pointermove/pointerup 提交旧值。保持一条共享 Transaction，取消/过期不提交。

冻结 Composition 的帧缓存按时间保存求值数据，选择变化仅替换 selection；冻结 Layer 的局部动画结果使用 WeakMap，每层最多16帧。修改一个 Layer 不会重新求值其他不变 Layer 的二维属性，父级/三维世界变换仍正确重新解析。可变输入和位置预览绕过缓存。

Canvas 按渲染工程、时间、图层选择、移动/属性/手柄预览 memo 输入；Renderer effect 只响应输入或屏幕手柄尺寸变化。关键帧选择、节点选择、状态、时间轴缩放不调用画布 Renderer。Timeline 静态轨道按工程、选区、当前关键帧 ID 与局部拖动状态缓存；播放头由父级 CSS 变量更新，添加关键帧读取 Store 当前时间，避免闭包过期。

`benchmark.html` / `src/dev/polish-benchmark.tsx` 是独立开发工具，不进入生产编辑器入口。BENCH-A/B 展开全部动画轨道，C 显示20节点 Graph，D 使用1080p合成与多个实际 Blur/Color；24次 RAF 节奏交互记录 React、Canvas、帧间隔与同步响应耗时。load/save 只报告 JSON/schema CPU，不能当原生磁盘耗时或稳定发行帧率。

OP-3：Canvas 对 committed Project 做精确结构比较，只排除 GraphNode 的 position/name/metadata；引用相同的分支立即返回。布局提交/Undo仍持久化为Command，但渲染复用上一视觉工程；参数、启用、端口/连接、其他未知字段、素材与嵌套合成均失效。属性/移动预览绕过此比较，避免每pointermove全工程遍历。渲染缓存只供单向读取，操作仍引用当前Store工程，不成为另一业务状态。

取消监听器使用 React Effect Event 获取最新回调，每组件只注册一次 blur/motion:cancel，卸载成对清理；持续输入不反复解绑注册。帧缓存保留最新选区包装，等值选区（Command订阅重新过滤数组）仍返回稳定快照。
OP-4：另存为默认已打开工程的路径和文件名；相同冻结版本缓存一次工程序列化，dirty、恢复和保存重复读取复用字符串。仅保留当前版本一项，避免历史JSON缓存累积。
