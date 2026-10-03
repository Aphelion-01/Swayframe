# Compositing Graph V0.1 设计与审计

## CG-0：现状与接入点

当前 Canvas2DRenderer 已将效果、遮罩、平面 3D 和预合成绘制到图层局部离屏表面；PNG 和桌面导出复用它。layer-compositing 处理模糊/空间效果，color-effects 处理真实 RGBA。Layer.editor.effects 是现有持久化效果栈。layerProperties 递归发现 Property，Animation Engine、Timeline、AnimatedField、Motion Curve 无须新增动画模型。CommandSystem 以隔离工程执行 Transaction，最终 schema 校验后一次提交，撤销存逆操作。底部工作区已有轨道与曲线 tabs。

## 数据与边界

新增 core/compositing-graph 类型与 DAG 验证、注册表、操作、编译器、服务；renderer 适配器实现 Canvas 节点 evaluator。Layer.editor.graph 成为唯一效果数据源；旧 effects 只作为迁移输入，迁移后删除。Project schema 升级 0.5.0，graph.version 固定 1。保留旧效果节点与参数 ID/关键帧，Source → 原效果顺序 → Output。简化栈由图拓扑计算，不额外保存；分支与非效果节点明确显示高级图。

用户图仅存 ID、owner、节点类型、端口、Property、坐标、启用与轻元数据。编译图仅在内存包含 Output 依赖闭包、拓扑序、输入映射、内部 pass 信息。核心没有 DOM/React/Canvas。可注册 evaluator，renderer 使用注册表调度。所有支持图层均已有局部图像来源，包括形状、文字、图片、纯色和预合成。

Source 是未处理局部像素；Output 唯一且保护删除。既有图层遮罩在 Source 之后、图层节点图之前应用，以保留旧视觉语义。Mask 节点生成可连接的 Mask 输出，Merge 可选 Mask 限制 A 前景，B 为背景；Over 使用源覆盖，Multiply/Screen/Add 使用共享 RGBA 合成函数。Transform 在同一局部表面围绕图层中心以既有矩阵函数实现。离屏尺寸包含有界空间效果 padding。

## 编辑、动画、错误与缓存

图操作转换为共享 Command（graph.replace 为目标粒度逆操作）与现有 property/keyframe 命令。插入节点的创建/断线/重连通过一次 Transaction；拖动坐标只在 UI 预览，松手一次提交。层/节点锁定与 Source/Output 保护在核心操作校验。节点选择 Inspector 复用 AnimatedField，Property 自动进入同一 Timeline 与 Graph Editor。

连接时校验方向、类型、容量、自连和环；允许暂时不完整输入以便编辑，编译报告缺口，渲染安全回退并展示诊断，不容许错误图崩溃。持久化及命令运行时使用严格 schema、全局实体 ID 与参数约束验证。

每层执行缓存以源像素版本、节点渲染签名、上游输出版本为键，有界并清除退出图的节点；签名排除节点名称、坐标、metadata 与 graph viewport。调整节点只使该节点及其下游失效。GUI viewport、选择、搜索、连线预览不进入工程与导出。源签名排除图布局变化，保留素材、内容、嵌套合成和动画求值变化。参数 scrub 使用原 Property preview。

## 阶段与验收

严格 CG-0 → CG-12：审计设计；模型验证；注册表；命令撤销；IO迁移；编译；基础节点；Merge/Mask；节点 UI；Inspector/Timeline；效果栈适配；缓存；Agent 服务。每阶段记录 lint/typecheck/tests/Web build/desktop build，状态见 outputs/COMPOSITING_GRAPH_STATUS.md。CASE01～10 由核心、渲染像素、GUI、保存迁移组合验证，真实浏览器补充 Canvas 模糊与操作证据；不能以 DOM 节点出现替代像素有效。

不实现全合成图、3D 节点、脚本、自定义 shader、AI 模型、复杂多 Viewer 或分布式缓存。
