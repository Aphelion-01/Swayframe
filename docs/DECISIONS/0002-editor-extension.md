# 0002 编辑器增量扩展

用户最新指令扩展历史 V0.1 范围。当前执行基线为 docs/baseline/MOTION_EDITOR_PHASE_A_I.txt，按 Phase A → I 推进，原 T0～T10 记录保留。

继承原有 Command、Transaction、History、秒时间单位和 Renderer Adapter。0.2.0 使用 Layer.editor 存放新增 Property、Mask 和 Effect。颜色、三维坐标和路径使用数值数组；Bezier 路径每点六个数值：位置、入切线和出切线。拓扑不同的路径保持前值，同拓扑逐点插值。

新增命令保存图层或合成粒度的逆操作；组合修改仍原子提交。父级和预合成循环在提交边界拒绝。旧版文件先严格验证再补全默认值迁移。新增扩展功能只采用确定性运算；不扩大现有 Mock AI。
