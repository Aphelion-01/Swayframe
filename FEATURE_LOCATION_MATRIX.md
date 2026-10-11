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
