# Motion Curve System

执行基线：`baseline/MOTION_CURVE_M1_M10.txt`。M1→M10 顺序实施，阶段完成时运行 typecheck/lint/tests/build；原始日志在 outputs/quality/M1.log～M10.log。

## 数据与数学

MotionCurve 为 `{type:'linear'}` 或 `{type:'cubic-bezier',x1,y1,x2,y2}`。X 在 0～1，Y 在 -10～10，支持预备与过冲。求值先用 Newton-Raphson 反解 Bx，退化时回退二分，再求 By；绝不把 By(u) 当 timing。求值函数缓存最多 256 条曲线。

区间 ID 是 `propertyId/fromKeyframeId/toKeyframeId`，只对当前相邻关键帧有效。曲线持久化沿用左关键帧 interpolation/outgoing、右关键帧 incoming；没有 Property.curve，也没有第二份曲线副本。Both 替换完整曲线，Out 只换 P1，In 只换 P2；Hold/Spring 用 Both 转换，单侧操作明确拒绝。不同拓扑路径不支持连续缓动。

二维位置可选 spatialOutgoing/spatialIncoming 为绝对局部空间控制点；时间曲线只改变沿空间曲线的进度。没有空间控制点时沿原直线插值。曲线路径按参数进度运动；真实速度由空间位置对时间求导，不假定弧长匀速。

## 命令与预览

`applyMotionCurveCommands(project, segmentIds, curve, mode)` 构造共享 keyframe.update 复合命令。所有 GUI 与 Agent 修改通过 CommandSystem 的一笔 Transaction，错误输入、锁定图层或失效区间不产生部分修改。只复制 easing，关键帧 ID、Time、Value、空间控制点保留。

拖动期间调用 `previewMotionCurve` 构造受影响 Property 的临时快照；`projectWithPropertyPreviews` 仅复制属性容器路径，保留无关 Layer/Asset 引用，不序列化整个工程、不重新初始化 Renderer。松手提交一笔事务，取消或工程变化时丢弃预览。排序关键帧按不可变 Property 缓存，区间用二分定位；轻量小球独立更新，不触发整个编辑器每帧重建。

## 两类图

动画缓动面板显示标准化时间与进度、P1/P2、X1/Y1/X2/Y2、影响比例、快速预设、Both/Out/In、Reverse/Mirror、曲线复制粘贴与小球。多区间曲线不同显示 Mixed；默认处理选中关键帧的全部相邻区间，也可切换仅当前区间。支持拖动右下角调整面板大小。

Graph Editor 保留属性值图和真实速度图。Number 使用绝对导数，Vec2/Vec3 使用各分量导数的范数，颜色和其他数组同理。速度按属性显示 px/s、deg/s、%/s 或单位/s；时间为秒。控制点水平拖动修改影响比例，竖直拖动修改速度。空间路径可在独立折叠区编辑控制点。

`spatialEndpointDistances` 计算空间曲线端点导数长度；速度与影响比例转换使用这个量，直线路径使用端点距离。API 同时提供出/入速度大小和沿进度方向的有符号 Velocity；零 X 控制点的退化导数使用数值极限。尖锐/无限端点速度以有限采样近似显示，归一化速度预览允许负值。

## 反转与镜像

Reverse 严格定义 `1-f(1-u)`，控制点变换为 `(1-x2,1-y2),(1-x1,1-y1)`。Mirror 保留指定一侧，将另一侧设为中心对称点，得到对称曲线；与 Reverse 的语义独立。

## 预设库

29 个内置 Linear、Ease、Sine/Quad/Cubic/Quart/Quint/Expo/Back In/Out/In-Out 与风格曲线。都是独立选择的贝塞尔近似，数学族名称描述风格，不宣称与解析正弦/多项式/指数函数逐点相等；未使用商业插件数据或资源。

用户预设保存 name、curve、category、createdAt，可选 tags 和 intensity。库支持改名、删除、收藏、副本、最近，采用独立版本化存储键 `motion-curve-library.v1`，跨工程复用，不进入 Project JSON。存储失败明确反馈；损坏库保留原数据，本次使用临时库，不覆盖原存储。

## 公共 API

```ts
const api = new MotionCurveAPI(commandSystem, 'agent', presetLibrary);
const curve = api.getMotionCurve(segmentId);
api.applyMotionCurve(segmentIds, curve, 'both');
api.analyzeMotionCurve(segmentId);
api.reverseMotionCurve(segmentIds);
api.saveMotionPreset('柔和标题', curve, { tags: ['soft'], intensity: 0.4 });
```

`getMotionCurve` 对 Hold/Spring 返回 null。apply/reverse 返回 TransactionResult；读取无效区间或未连接预设库时抛出明确错误。`motionSegments` 枚举区间，`selectedMotionSegments` 将跨属性关键帧选择转换为区间列表。Intelligence 未来只推荐曲线或 Proposal，应用阶段调用这些命令，核心不模拟鼠标。

MotionCurveGenerator、SpringCurveParameters、BounceCurveParameters、FutureMotionCurve 预留 Spring/Bounce/Elastic/Custom 类型契约；本次未增加生成器运行时或 Bake 功能。

## 文件格式与验收

当前格式 0.3.0，支持 0.1.0/0.2.0 迁移；0.2 迁移保持全部 ID 与旧入出曲线。空间控制点只允许二维 Position，其他属性在命令提交和工程加载边界拒绝。

112 项自动测试及 9 个真实 GUI 验收场景通过。重点覆盖非对称 X 求逆、Y<0/Y>1、Number/Vector/Color 插值、反转与镜像、多区间/多属性、Undo/Redo、预设序列化、非法输入、真正 pointermove-before-pointerup 实时预览和空间路径不变性。证据见 outputs/MOTION_CURVE_ACCEPTANCE.md。
