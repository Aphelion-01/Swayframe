# Motion Curve System

当前基线为 docs/baseline/MOTION_CURVE_M1_M10.txt，按 M1→M10 执行。

MotionCurve 是可序列化的标准化 Linear/CubicBezier API 类型，持久化时映射至已有左关键帧 interpolation/outgoing、右关键帧 incoming，不增加 Property.curve 或重复持久化副本。区间 ID 使用 propertyId/fromId/toId，仅相邻关键帧有效。

Temporal 与 Spatial 分离：关键帧可选 spatialOutgoing/spatialIncoming 为二维位置局部坐标，独立于 normalized easing。默认仍为直线路径，旧工程无需迁移。空间路径编辑必须经过 keyframe.update，修改缓动不写空间字段。

拖动只替换受影响 Property 的临时快照，松手提交单一事务。预设库是独立版本化用户数据，不进入工程文件，存储由 UI 适配器注入。未来生成器仅保留类型契约；Hold/Spring 可显示不支持，用户完整应用时显式转换为 CubicBezier。

Both 替换完整区间；Out 仅替换第一控制点；In 仅替换第二控制点。Reverse 定义为 1-f(1-u)。Mirror 将选定一侧复制为中心对称的另一侧，产生对称曲线；不作为 Reverse 的别名。
