# 工程文件 0.2.0

JSON 根节点包含 schemaVersion、Project UUID、name、compositions、activeCompositionId、assets。Composition 保存尺寸、fps、秒制 duration、RGBA 背景和有序 layers；二维图层数组后部绘制在上方，三维平面按深度绘制。

所有实体使用 UUID。Transform 保存 position/scale/rotation/opacity，Layer.editor 保存额外 Property、父级、图层时间范围、混合模式、遮罩、效果及三维开关。Property 包含 id、baseValue 和 keyframes，值可为 number、Vec2 或数字数组。RGBA 为四分量 0～1，XYZ 为三分量；路径每个点为六个坐标（点、入切线、出切线），坐标为图层局部像素。

二维位置使用合成左上角像素坐标，缩放 1 为 100%，旋转为度，透明度为 0～1。Anchor 使用图层中心相对坐标。三维 XY 同合成坐标，Z 为深度；摄像机 XY 原点为合成中心，默认 Z=-1000，沿正 Z 看，焦距为像素单位。世界矩阵继承父级；摄像机视图矩阵再投影到合成。

关键帧支持 Linear/Hold/Bezier/Spring。incoming/outgoing 为归一化时间/值切线；区间优先使用左帧 outgoing 和右帧 incoming，否则采用历史 interpolation 参数。向量和同拓扑数组逐分量插值，不同拓扑路径保持左帧值。首帧前、末帧后分别保持端点值。Spring 允许过冲，端点归一化。

遮罩保存路径、模式和可动画 opacity/feather/expansion；效果保存 type、enabled 和可动画参数，按数组顺序处理。Precomp 通过 compositionId 引用，递归引用和父级循环均拒绝。inPoint/outPoint 决定图层可见范围，startTime 决定局部动画时间。素材通过 assetId 复用 PNG/JPEG/WebP/GIF 内嵌资源，GIF 当前静态。

`migrateProject` 先严格校验 0.1.0 文件，再补齐 editor；旧实体 ID 保留。0.2.0 原样验证，未知版本拒绝。JSON/schema/引用/全局 ID/关键帧时间检查通过后，才由系统 Command 替换工程。新字段和效果参数有严格范围检查。

文件不保存 DOM、Canvas、位图缓存、选择、播放头、画布缩放或 History。资源上限：JSON 20 MB、单图片原文件 10 MB、500 图层/合成、100 合成、500 assets、10000 关键帧/属性、尺寸 16384、fps 240、时长 3600 秒。PNG 序列单次最多 3000 帧或 512 MB；区间左闭右开，ZIP 内附 manifest 时间表。

Video 解码和媒体同步未接入。未来可沿 LayerBase、assetId、RendererAdapter 和局部时间求值扩展；当前 schema 不接受伪视频图层，GUI 不显示无法工作的入口。

## 0.3.0 Motion Curve 扩展

当前保存版本为 0.3.0，加载支持 0.1.0/0.2.0/0.3.0。0.2 迁移保持全部 ID、值、时间与旧 incoming/outgoing；标准化 MotionCurve 沿用这些区间字段，不单独序列化 Property.curve。

Position 关键帧可保存 spatialOutgoing/spatialIncoming 两个局部绝对 Vec2 控制点；其他 Property 拒绝空间控制点。修改时间缓动只改 interpolation、outgoing/incoming；空间字段与时间/值保持。没有空间字段时使用原有直线路径。

用户预设库单独版本化，保存名称、曲线、分类、创建时间、可选 tags/intensity；不进入工程。Spring/Bounce/Elastic 生成器仅预留接口，不是工程文件可执行的新插值类型。

## 当前 0.5.0：图层合成节点

当前保存版本是 0.5.0，加载支持 0.1.0～0.5.0。0.4.0 的 Linked Asset 字段保持。每个 Layer.editor.graph 保存 version=1、UUID、owner、outputNodeId、nodes 和 edges。Node 保存 type/name/enabled/position、注册端口定义、可动画 params 和可选轻元数据；Edge 保存 UUID、from/to 的 nodeId 与 portId。

迁移把旧 effects 按原顺序转成 Source→Effects→Output，保留效果节点、Property、Keyframe ID、参数与启用状态；旧 Hue/Saturation 补 lightness=0。迁移后删除 effects，不能同时保存 graph 与非空 effects。图层复制重建 Graph/Node/Edge/Property/Keyframe ID 和 owner 引用。节点位置、名称、参数、连线与动画随工程保存；图视口、选择和编译/位图缓存不保存。

严格校验节点注册类型、端口与参数、唯一 Source/Output、owner、全局 ID、连接类型/输入容量与 DAG。每图最多 200 节点和 1000 条边。缺少必需连接可暂存以支持编辑，编译/渲染显示诊断并安全回退。旧版 Swayframe 不支持 0.5.0 文件，需要使用 0.6.0 或更新的软件打开。
