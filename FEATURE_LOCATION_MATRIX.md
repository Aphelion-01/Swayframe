# Feature Location Matrix

主归属来自生产 Feature Registry；secondary 必须服务不同工作流。完整参数与动态控件位置见 FEATURE_INVENTORY.md。

| Feature | Primary Location | Secondary | Shortcut | Permanent UI |
|---|---|---|---|---|
| new 新建工程 | menu.file |  | CommandOrControl+N | context/menu/section |
| open 打开工程 | menu.file |  | CommandOrControl+O | context/menu/section |
| save 保存工程 | menu.file |  | CommandOrControl+S | context/menu/section |
| save-as 工程另存为 | menu.file |  | CommandOrControl+Shift+S | context/menu/section |
| new-composition 新建合成 | panel.project | menu.file | — | context/menu/section |
| composition-settings 合成设置 | menu.file |  | — | context/menu/section |
| import 导入媒介到素材库 | panel.project | menu.file | — | context/menu/section |
| export 导出 | menu.file | toolbar.global | — | budgeted |
| settings 设置 · AI | menu.file |  | — | context/menu/section |
| undo 撤销 | menu.edit | toolbar.global,context.keyframe,context.node | CommandOrControl+Z | budgeted |
| redo 重做 | menu.edit | toolbar.global | CommandOrControl+Shift+Z | budgeted |
| cut 剪切 | menu.edit | context.keyframe,context.node | CommandOrControl+X | context/menu/section |
| copy 复制 | menu.edit | context.canvas,context.layer,timeline.layerContext,context.keyframe,context.node | CommandOrControl+C | context/menu/section |
| paste 粘贴 | menu.edit | context.canvas,context.layer,timeline.layerContext,context.keyframe,context.node | CommandOrControl+V | context/menu/section |
| duplicate 创建副本 | menu.edit | context.keyframe,context.node | CommandOrControl+D | context/menu/section |
| delete 删除选中 | menu.edit | context.keyframe,context.node | — | context/menu/section |
| select-all 全选 | menu.edit | context.keyframe,context.node | CommandOrControl+A | context/menu/section |
| create-object 创建对象 | menu.layer |  | — | context/menu/section |
| rename 重命名 | context.layer | menu.layer,context.canvas,timeline.layerContext | — | context/menu/section |
| precompose 选中图层预合成 | context.layer | menu.layer,context.canvas,timeline.layerContext | — | context/menu/section |
| parent-null 创建父级空对象 | context.layer | menu.layer,context.canvas,timeline.layerContext | — | context/menu/section |
| parent-select 设置父子级 | panel.inspector.structure | menu.layer,context.layer,panel.scene,context.canvas,timeline.layerContext | — | context/menu/section |
| toggle-3d 切换三维图层 | panel.scene | menu.layer,context.layer,context.canvas,timeline.layerContext | — | context/menu/section |
| align 对齐与分布 | menu.layer |  | — | context/menu/section |
| keyframe 记录选中属性关键帧 | timeline.propertyContext | menu.animation,context.property | — | context/menu/section |
| interpolation 关键帧插值与缓动 | menu.animation |  | — | context/menu/section |
| graph 打开曲线编辑器 | motion.toolbar | menu.animation,context.property,context.keyframe | Shift+F3 | context/menu/section |
| motion-curve 曲线编辑器：缓动 | motion.toolbar | menu.animation,context.property,context.keyframe | — | context/menu/section |
| previous-key 上一个关键帧 | menu.animation |  | — | context/menu/section |
| next-key 下一个关键帧 | menu.animation |  | — | context/menu/section |
| fit 适合窗口 | menu.view |  | CommandOrControl+0 | context/menu/section |
| actual-size 100% 实际尺寸 | menu.view |  | CommandOrControl+1 | context/menu/section |
| zoom-in 放大 | menu.view |  | CommandOrControl+= | context/menu/section |
| zoom-out 缩小 | menu.view |  | CommandOrControl+- | context/menu/section |
| show-project 项目与素材 | menu.window |  | — | context/menu/section |
| show-layers 图层与层级 | menu.window |  | — | context/menu/section |
| assistant 创作助手 | assistant.actions | menu.window | — | context/menu/section |
| toggle-right 切换属性面板 | menu.window |  | — | context/menu/section |
| timeline 打开时间轴 | timeline.header | menu.window | — | context/menu/section |
| compositing 打开合成节点 | menu.window |  | — | context/menu/section |
| toggle-left 切换左面板 | menu.window |  | — | context/menu/section |
| toggle-bottom 切换底部工作区 | menu.window |  | — | context/menu/section |
| reset-workspace 恢复默认工作区 | menu.window |  | — | context/menu/section |
| help 操作指引 | menu.help |  | — | context/menu/section |
| shortcuts 快捷键 | menu.help |  | — | context/menu/section |
| palette 搜索命令 | menu.help | toolbar.global | CommandOrControl+K | budgeted |
| about 关于 Swayframe | menu.help |  | — | context/menu/section |
| create-rectangle 创建 矩形 | panel.scene |  | — | context/menu/section |
| create-ellipse 创建 椭圆 | panel.scene |  | — | context/menu/section |
| create-polygon 创建 多边形 | panel.scene |  | — | context/menu/section |
| create-star 创建 星形 | panel.scene |  | — | context/menu/section |
| create-path 创建 路径 | panel.scene |  | — | context/menu/section |
| create-text 创建 文字 | panel.scene |  | — | context/menu/section |
| create-camera 创建 摄像机 | panel.scene |  | — | context/menu/section |
| create-solid 创建 纯色 | panel.scene |  | — | context/menu/section |
| create-null 创建 空对象 | panel.scene |  | — | context/menu/section |
| align-0 左对齐 | context.canvas |  | — | context/menu/section |
| align-1 水平居中 | context.canvas |  | — | context/menu/section |
| align-2 右对齐 | context.canvas |  | — | context/menu/section |
| align-3 顶对齐 | context.canvas |  | — | context/menu/section |
| align-4 垂直居中 | context.canvas |  | — | context/menu/section |
| align-5 底对齐 | context.canvas |  | — | context/menu/section |
| align-6 水平分布 | context.canvas |  | — | context/menu/section |
| align-7 垂直分布 | context.canvas |  | — | context/menu/section |
| ease-in 缓入 | context.keyframe | timeline.keyframeContext,motion.toolbar | — | context/menu/section |
| ease-out 缓出 | context.keyframe | timeline.keyframeContext,motion.toolbar | — | context/menu/section |
| ease-both 缓入缓出 | context.keyframe | timeline.keyframeContext,motion.toolbar | — | context/menu/section |
| linear 线性 | context.keyframe | timeline.keyframeContext,motion.toolbar | — | context/menu/section |
| hold 保持 | context.keyframe | timeline.keyframeContext,motion.toolbar | — | context/menu/section |
| effect-brightnessContrast 添加亮度 / 对比度 | panel.inspector.effects |  | — | context/menu/section |
| effect-exposure 添加曝光 | panel.inspector.effects |  | — | context/menu/section |
| effect-hueSaturation 添加色相 / 饱和度 | panel.inspector.effects |  | — | context/menu/section |
| effect-temperature 添加色温 | panel.inspector.effects |  | — | context/menu/section |
| effect-tint 添加色调 | panel.inspector.effects |  | — | context/menu/section |
| effect-levels 添加色阶 | panel.inspector.effects |  | — | context/menu/section |
| effect-gaussianBlur 添加高斯模糊 | panel.inspector.effects |  | — | context/menu/section |
| effect-dropShadow 添加投影 | panel.inspector.effects |  | — | context/menu/section |
| effect-glow 添加发光 | panel.inspector.effects |  | — | context/menu/section |
| effect-tintFill 添加着色 | panel.inspector.effects |  | — | context/menu/section |
| mask-rectangle 添加矩形遮罩 | panel.inspector.effects |  | — | context/menu/section |
| mask-ellipse 添加椭圆遮罩 | panel.inspector.effects |  | — | context/menu/section |
| mask-path 添加路径遮罩 | panel.inspector.effects |  | — | context/menu/section |
| split-layer 在播放头拆分图层 | timeline.layerContext |  | — | context/menu/section |
| remove-animation 移除选中属性动画 | context.property | timeline.propertyContext | — | context/menu/section |
| layer-copy 复制图层 | context.layer | context.canvas,timeline.layerContext | — | context/menu/section |
| layer-delete 删除选中图层 | context.layer | context.canvas,timeline.layerContext | — | context/menu/section |
| layer-visibility 切换图层可见性 | context.layer | context.canvas,timeline.layerContext | — | context/menu/section |
| layer-lock 切换图层锁定 | context.layer | context.canvas,timeline.layerContext | — | context/menu/section |
| parent-remove 解除父级 | context.layer | context.canvas,timeline.layerContext | — | context/menu/section |
| enter-precomp 进入预合成 | context.layer | context.canvas,timeline.layerContext | — | context/menu/section |
| copy-easing 复制缓动 | context.keyframe | timeline.keyframeContext,motion.toolbar,motion.segmentContext | — | context/menu/section |
| paste-easing 粘贴缓动 | context.keyframe | timeline.keyframeContext,motion.toolbar,motion.segmentContext | — | context/menu/section |
| tool-select 选择工具 | toolbar.canvas |  | V | budgeted |
| tool-hand 平移工具 | toolbar.canvas |  | H | budgeted |
| tool-rectangle 矩形工具 | toolbar.canvas |  | R | budgeted |
| tool-ellipse 椭圆工具 | toolbar.canvas |  | E | budgeted |
| tool-pen 钢笔工具 | toolbar.canvas |  | P | budgeted |
| tool-text 文字工具 | toolbar.canvas |  | T | budgeted |
| layer-color 图层颜色 | context.layer | context.canvas,timeline.layerContext | — | context/menu/section |
| asset.add 添加到当前合成 | context.asset |  | — | context/menu/section |
| asset.relink 重新链接 | context.asset |  | — | context/menu/section |
| asset.delete 删除素材 | context.asset |  | — | context/menu/section |
| node.rename 重命名节点 | context.node |  | — | context/menu/section |
| node.duplicate 复制节点 | context.node |  | — | context/menu/section |
| node.delete 删除节点 | context.node |  | — | context/menu/section |
| node.add 添加节点 | context.node |  | — | context/menu/section |
| node.fit 适应所有节点 | context.node |  | — | context/menu/section |
| edge.insert 在连线上插入节点 | context.node |  | — | context/menu/section |
| edge.disconnect 断开连线 | context.node |  | — | context/menu/section |
| create-image 导入 图片 / 音视频 | panel.scene |  | — | context/menu/section |
| motion.edit-segment 编辑缓动 | motion.segmentContext |  | — | context/menu/section |
| motion.reset-segment 重置缓动 | motion.segmentContext |  | — | context/menu/section |
| import-model 导入三维模型… | panel.project | menu.file,panel.scene | — | context/menu/section |
| camera-frustum 拍摄范围 | panel.inspector.3d |  | — | context/menu/section |
| motion-paths 运动路径 | panel.inspector.transform | menu.view | — | context/menu/section |
| canvas-aids 网格 / 参考线 / 标尺 | menu.view |  | — | context/menu/section |
| text-animator 文本动画 | panel.inspector.text |  | — | context/menu/section |
| spatial-translate 三维移动手柄 | panel.inspector.3d |  | — | context/menu/section |
| spatial-rotate 三维旋转手柄 | panel.inspector.3d |  | — | context/menu/section |
| effect-browser 添加效果 | panel.inspector.effects |  | — | context/menu/section |
| create-radial-generator 创建 径向渐变 | panel.scene |  | — | context/menu/section |
| effect-forge 程序化效果草稿 | panel.inspector.effects |  | — | context/menu/section |
| node.ai 用 AI 修改节点 | panel.inspector.effects | context.node | — | context/menu/section |
| branch.ai 用 AI 修改上游分支 | context.node |  | — | context/menu/section |
| graph.ai 从需求生成合成 | context.node |  | — | context/menu/section |
| toggle-motion-blur 切换动态图层模糊 | panel.scene |  | — | context/menu/section |
### 0.9.22 Placement Review

- 效果与调色：Layer/Effect/Property，Style/Process，F2，LayerSelection；canonical 仍为 panel.inspector.effects，由注册 color-effects Section 在 Inspector 顶部效果页呈现，复用 effect-browser 和参数化 Graph Command。属性页的 effects Section 仅管理合成/混合/遮罩。复用已有 Tabs，无全局按钮预算变化。
- 图层选择定位：SceneObject/Layer，Navigate/Inspect，F2，LayerSelection；canonical 为现有 panel.scene 选择手势。selectLayerFromPanel 发起 UI 导航，既有 Timeline 执行展开/滚动；没有新增 Scene 数据或无参永久按钮。Timeline 自身选择保持手动折叠语义。
- UX 检查：页签标题常驻、选中下划线可见、方向键切换；效果浏览器原入口继续可用；隐藏参数不进入键盘焦点；定位只改变 UI，不抢改播放头、不新增撤销。空选区/不支持效果的图层展示说明。


### 0.9.23 Placement Review

- 素材导入：Asset/Create/Manage，F3，Project/Composition；canonical 沿用 panel.project 和既有文件导入命令。扩展同一格式表、同一解码器，不新增按钮。
- 参考图分析与结果对比：ASSISTANT，Automate/Inspect，F3，AssistantMode；canonical 沿用 assistant.actions。结构化分析与视觉迭代只产生 Proposal，应用仍为 AgentTransaction。
- 错误反馈：现有操作记录自动展开失败工具，错误字段/输入/契约可查；视觉检查按轮次显示实际画面和差异，不占用全局工具栏。
- UX 检查：失败不再混同成功，自动修复有上限、重复无效参数及无实际修改会停止；对话、计划、工具、视觉检查沿用分区。保持草稿和撤销，视图状态不进入 Scene。

### 0.9.25 Placement Review

- 对象/任务：效果定义用于浏览和应用；已应用的实例用于参数编辑。F2，图层选中上下文，固定域 INSPECTOR。
- Canonical：panel.inspector.effects 保留为“效果”页的内嵌效果目录（color-effects Section）；effect-instances Section 在“属性”页呈现已应用效果、启用/排序及参数。原0.9.22两页分工由本条更新。
- 复用现有 Tabs、EffectBrowser、CompositingControls、Graph Command/Transaction，未新增全局按钮。原 effect-browser 命令直接切换到目录；目录没有“添加效果”中间按钮或弹窗。
- UX检查：无选择仍可浏览，应用禁用并有原因；选中图层直接点效果名称应用，参数只在属性页显示；切页滚动归零，避免目录搜索入口因旧滚动位置隐藏；紧凑单行目录、搜索和分类复用现有入口。

- 0.9.26 Agent 原生渐变填充复用已有 ASSISTANT / assistant.actions 自动化入口；场景对象为既有 shape/solid/text，任务为参考重建的外观修改，频率按需、上下文为目标图层。直接参数编辑仍归 INSPECTOR / appearance Section；不新增永久 UI、工具名称或功能域。

### 0.9.29 Placement Review

- 系统字体：Text Layer / Property，Style，F2，LayerSelection，固定域 INSPECTOR；canonical 为既有 panel.inspector.text。注册 text Section 内替换原字体 TextField 的硬编码建议，读取系统安装字体并沿用输入筛选、实时预览和 layer.patch 提交，不新增全局按钮或新的命令体系。
- 音频播放修复：Asset / Playback，PROJECT 与共享预览上下文；导入沿用原 panel.project / assets.import。只补齐本地媒体 CSP 与协议 stream 权限，未新增 Scene 字段，原 asset.add / layer.create Transaction 和撤销保持不变。
- UX 检查：字体读取状态与失败说明可见，手动输入及 Esc 取消保留；参数预览不产生 Undo，提交走既有 Command。真实 MP3/FLAC 不再被误报为要求转换格式；未授权远程媒体或任意字体脚本。


0.9.30：Agent 有限自动恢复状态及默认折叠的开发者详情沿用 ASSISTANT / assistant.actions。对象：当前 Agent 会话；任务：观察计划修复与执行恢复；频率：按错误发生；上下文：既有操作记录。无新常驻按钮、无新 Scene 属性；执行沿用 AgentTransaction / Command System。

恢复预算参数表单复用既有 AssistantMode 设置 Section（ASSISTANT / assistant.actions）；低频应用配置，放入“自动恢复预算”折叠组，不进入 Scene，不添加全局入口。

## 0.10 Agent configuration and diagnostics

对象：Agent 会话/应用配置；任务：配置指导与计划传输、诊断失败；频率 F5；上下文 AssistantMode。九域归属 ASSISTANT，规范入口 assistant.actions。AI → Agent 既有参数 Section 增加原生 Skill 总开关/五技能开关及 tools/structured-plan，布局状态不进 Scene。agent-export-diagnostic 注册 Feature 与 assistant scoped Command；在既有助手开发者 details 使用 typed contributionItems，元数据不含业务回调。导出包含版本/对象绑定/用量/分层验证，省略用户文字、Scene 内容与图片。

Feature Placement Review：复用已有低频折叠入口；永久工具栏增量 0；无新功能域或全局按钮。UX heuristic：状态可见、可停止、错误保留、开发日志按需展开、导出隐私说明可见，关闭 Skill 不关闭底层编辑能力。注册与预算由 feature-registry 回归检查。

## 1.0.1 V2-5 Feature Placement Review

`agent-v2-test`：Application/Composition，Inspect/Automate，F5，AssistantMode，固定域 ASSISTANT，canonical 为 `assistant.actions`。显式开发者 flag `#agent-v2-test` 才显示助手内“开发者：V2 隔离测试”；沿用 scoped Command / typed contribution，不增加全局常驻按钮，不新增 API 设置。

独立 EditorStore 不接收当前用户工程，不绑定文件服务或持久化。Proposal 预览使用实际 Renderer；接受/拒绝、Undo/Redo 是该隔离工作流的参数化控制，正式修改复用 AgentTransaction / CommandSystem。普通助手明确标示 Legacy V1。正式 Canary 默认关闭，测试窗口不是生产工程迁移。

UX heuristic：启用与费用说明可见，失败保留输入，运行可停止，接受前显示计划及画布，拒绝不提交，诊断导出省略输入/模型原文/Scene/图片；Modal 复用焦点圈定、Esc 与焦点返回。低频入口隐藏于明确开发 flag，未增加功能域或永久按钮预算。


## 1.0.2 V2-6 recovery placement review

沿用 `agent-v2-test`：ASSISTANT / assistant.actions，Application/Composition，Inspect/Automate，F5，AssistantMode 与明确开发 flag。恢复进度、已完成步骤、失败草稿只读检查和脱敏 Trace 属于既有隔离工作流；无新增永久按钮、功能域或全局入口。修改字号复用实际 `setFontSize` Command/Transaction，V2 测试子集为 10 个既有 WRITE 工具，未添加新工具算法。

UX heuristic：执行/恢复/验证状态可区分；恢复成功不显示历史错误警报；失败保留输入，未完成草稿明确标记且禁用接受；不确定写入直接停止，不能伪装成完成结果。沿用 Modal 焦点和 Esc 行为，开发者细节默认折叠，不进入 Scene。布局使用 DESIGN.md 的现有密度、颜色与滚动规则。Feature registry / placement validation 随质量门禁运行。

## 1.0.3 Agent Core V2-7

`agent-runtime-choice`：ASSISTANT / assistant.actions，Application，Automate，F5，AssistantMode。既有助手内选择 V1/V2 Beta；V1 默认，工作中不可切换。

`agent-v2-new-session`：ASSISTANT / assistant.actions，Application，Automate，F5，AssistantMode。复用新会话语义及现有 typed contribution；不进入全局工具栏。`agent-export-diagnostic` 复用原注册入口，按当前引擎导出脱敏执行与跨轮次元数据。草稿接受、拒绝、停止沿用既有助手任务操作区；正式写入仍为 AgentTransaction / Command System。

对象属性、尺寸与字体属于原 INSPECTOR；本轮只为 V2 最小 WRITE 子集映射能力，不新增属性入口或永久全局按钮。
V2-7 服务异常修正：`model_not_found` 等明确模型配置错误沿用 ASSISTANT / assistant.actions 的失败信息，指向既有设置 · AI / 管理入口。对象是当前模型路由，任务是修正不可用模型，F5、失败上下文；不新增命令、永久按钮或功能域，不修改Scene，不自动换模型。Feature Placement Review：复用既有入口，注册元数据与业务回调无变化；回归覆盖提示、输入保留和零事务。

| import-layerpack 导入分层合成 | menu.file | commandPalette、dialog.actions（确认/取消） | 无 | 无新增永久按钮；PROJECT / Asset+Composition / Create / F4；选择文件夹→校验预览→确认后单次事务导入独立原生合成 |
| cancel-layerpack 取消图层包导入 | menu.file | 无 | 无 | 无新增永久按钮；PROJECT / Asset / Manage / F5；仅导入进行中可用 |

## MCP Bridge V0

Application / Project，Manage / Automate，F5，全局应用配置；固定域 APPLICATION，canonical 复用 `settings` → `menu.file`，设置窗口的 MCP 页。复用原 settings Command 和 typed contribution；页内权限/连接参数由该 Section 管理，不注册每个 checkbox 为全局命令。无新增 toolbar、shell 按钮。真实写入仍经 EditorOperations → 原 Command/Transaction；外部调用不走 Agent Planner。仅本机、主动启用、临时一次连接、只读/编辑/导入分权，状态与失败原因可见。内部 UX check：默认关闭、防误授权、可撤销权限、临时凭据明确、失败保留，非真人可用性研究。

## AI2Comp V0.1 图片转分层

Asset/Composition，Create，F4，Composition，PROJECT，canonical menu.file：`image-to-layers`。复用原 Editor Command Registry、原 LayerPackImportDialog、状态/预览/确认/取消；不增加永久 toolbar。macOS 本地 Vision 只生成标准 Layer Package，不持有 Scene。确认后才交给原 importLayerPack / Command / Transaction；输出文件是用户选择位置的独立导出，不受 Scene Undo 删除。Windows原型无本机分割后端，清楚提示仍可导入外部分层包。Feature Placement Review：与素材导入同域、单一主入口、无新编辑内核；页内选图/重选/取消为该流程的参数与状态控制。


## V2 Capability Unlock 编辑模式

`agent-v2-edit-mode`：Application/Composition，Automate，F5，AssistantMode，ASSISTANT，canonical `assistant.actions`。复用助手面板的参数选择器与 scoped Command；审阅默认，直接编辑需明确选择，模式不进入 Scene。普通操作仍生成 Proposal、验证后通过原 AgentTransaction 自动提交；结构、资产、超过40步或20目标及明确预览回到审阅。全局工具栏增量0，Feature 元数据无业务回调。Feature Placement Review：单一主入口、可键盘操作、任务中禁用模式切换、模式与回退原因可见、Undo保留。

## 1.0.4 — Assistant Chat

| 能力 | 对象 / 任务 / 频率 / 上下文 | 固定域 / canonical home | 入口与约束 |
| --- | --- | --- | --- |
| 对话式助手、实际操作状态与折叠执行记录 | 当前 Agent 会话 / Automate、Inspect / F2/F3 / AssistantMode | ASSISTANT / assistant.actions | 复用左侧助手；消息区独立滚动，输入区固定。不改全局工具栏，不进入 Scene。 |
| 发送 / 停止、清空上下文 | 当前会话 / Automate / F2/F3 / AssistantMode | ASSISTANT / assistant.actions | agent-chat-send、agent-chat-clear scoped Command；清空丢弃待接受草稿，不删除 Scene 或 Undo。 |
| 提示词文件、Skill、模型、思考深度 | 当前任务与应用配置 / Automate / F2/F3 / AssistantMode | ASSISTANT / assistant.actions | agent-chat-attach、agent-chat-skill、agent-chat-model、agent-chat-effort；输入区图标和按需弹出参数组。TXT/MD 仅作为用户需求，不能安装代码或扩权。 |
| 选中图层高亮引用 | Layer / 指定编辑目标 / F1 / AssistantMode | ASSISTANT / assistant.actions | 输入区标签；V2 显式 projectId、compositionId、layerIds，发送时原 Session 再校验。名称只用于展示。 |
| 引擎与旧建议 | Application / 配置、Inspect / F2/F3 / AssistantMode | ASSISTANT / assistant.actions | 既有助手设置菜单；V1 默认。离线模拟建议保留在二级折叠入口并标明来源。 |

Feature Placement Review：单一助手入口、全局控件增量 0；六项会话命令注册 Feature 元数据及 typed contributionItems；参数不建立新的 Registry。模型与 Skill 任务中禁用；停止保持可用。图标均有可访问名称、悬停说明、焦点与按压反馈；支持 reduced-motion。思考深度调整规划检查要求，不声称切换未声明的服务端内部推理协议。正式修改沿用原 AgentTransaction / Command System。
