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
| import 导入图片到素材库 | panel.project | menu.file | — | context/menu/section |
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
| parent-select 设置父子级 | panel.inspector.structure | menu.layer,context.layer,context.canvas,timeline.layerContext | — | context/menu/section |
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
| create-image 导入 图片 | panel.scene |  | — | context/menu/section |
| motion.edit-segment 编辑缓动 | motion.segmentContext |  | — | context/menu/section |
| motion.reset-segment 重置缓动 | motion.segmentContext |  | — | context/menu/section |
