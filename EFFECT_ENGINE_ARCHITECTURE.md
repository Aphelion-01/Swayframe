# Swayframe V0.3 Unified Effect Engine

## 真实执行基础

保留现有 Canvas2D Renderer 与三维平面/网格投影。内置模糊、颜色效果继续使用已验证的 Canvas filter / 像素实现，没有重写渲染器。程序化效果使用 `declarative-pixel-v1`，不是 WGSL、WebGPU 或任意脚本执行环境。

`visual-capabilities.ts` 统一能力定义、类别、端口、参数、版本、实现入口、动画/时间/确定性能力。旧 `effect-definitions.ts` 的十项内置效果经兼容适配纳入注册表；旧 EffectRegistry 是兼容视图。径向渐变只有一份 `radial-gradient.ts` 算法，Fill、Generator、Graph 都调用它。

Graph 的 Solid / Transform / Mask / Merge 在原注册点适配为统一能力，保留原端口和执行器；Merge 仍具有前景、背景、遮罩多个输入。它们的主要入口保留在 Graph，普通 Add Effect 不显示需要手动连线的 Compositor。

## 数据与命令

图层处理实例唯一保存在 `layer.editor.graph`。Inspector Effects 是 Graph 的严格线性投影；遇到分支或额外处理节点时只展示节点参数，关闭栈重排，不删除或扁平化连接。`processing-stack.ts` 支持以 Generator 为链首的处理栈；生成器不能移动到滤镜之后。删除生成器会恢复 Source 连接。

参数继续使用标准 `Property<AnimValue>`，包括颜色、向量和扁平多色标。Inspector、Timeline、Graph 共用属性 ID、动画求值、预览覆盖和 `valueCommand`。连续拖动实时预览，正式提交进入已有 Command/Transaction。离散参数在 Graph 求值后量化；不同数量的渐变色标沿用数组属性的保持切换规则。

工程修改使用 `layer.create`、`graph.replace` 和标准 Property Command。Agent 用 AgentTransaction 沙箱预览后提交。Draft、库、信任及窗口状态均不写入 Scene；Intelligence 仍只产生 Proposal。

## 运行时与缓存

Effect Package 内嵌于 GraphNode，节点类型为 `fx.<完整SHA256>`。定义按内嵌包解析，不使用“效果库当前最新版本”。SHA256 覆盖规范化 JSON 源定义，版本、参数 Schema、端口及程序均进入哈希。

程序为有界、只向前引用的标量指令序列，输出四个 RGBA 引用。没有循环、eval、动态函数、网络、文件、Node.js 或系统 API。编译器验证操作、引用、参数分量、端口及资源预算。按内容哈希缓存编译结果；参数变化不重编译。节点执行缓存包含参数、输入版本、时间依赖、尺寸、padding 和 fps，布局坐标不影响执行缓存。

CPU 后端生成真实 RGBA 像素，再交给原有 Canvas 合成路径。Generator 无图像输入，Filter 接收单张图像。失败时预览旁路并提供诊断；导出检测错误并停止，不能把缺失效果静默输出为成功。复杂 CPU 效果不承诺实时帧率。

2026-10-09 优化：`pixel-program.ts` 将已验证指令编译为固定数字操作码及依赖计划，区分帧常量、行、列和逐像素计算，并移除不可达指令。列复用缓存每次最多8MiB，超限退回逐像素计划；预算仍按原声明的指令数检查。算术顺序、Float64 精度、非有限值回退、采样位置及 RGBA 舍入保持不变。计划不保存上帧参数或像素，参数变化无需重编译。没有引入动态代码生成或新权限。

## 工程兼容与信任

保留工程 0.7.0 的向后读取；新增字段为可选扩展。旧效果栈继续迁移到 Graph。旧版本应用不保证能读取新增程序化节点。

工程包内嵌指定效果版本和内容哈希。用户库更新、删除不会改变已保存工程。未知、缺失或哈希不匹配的程序化节点保留 ID、端口和参数，运行时诊断；超出包大小/结构深度的恶意内容直接拒绝。外部工程中的自定义包需要本机信任，信任记录经壳层注入存储，并与 Scene 分离。

## 扩展边界

后续增加能力，应从统一定义和后端适配器扩展，复用现有 Section、Tool 和 Command 注册点。第一代不提供任意插件、远程插件分发、多个外部纹理资源、依赖下载或 GPU 编程框架。
