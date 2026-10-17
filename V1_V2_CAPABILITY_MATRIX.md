# V1_V2_CAPABILITY_MATRIX

源码冻结：`066e172c23ecb7f24075d284eacc7b034f3dc36b`（父版本 `3c787b2`），分支 `codex/agent-v2-capability-unlock`，产品版本 `1.0.3`。

支持含源码已实现；实际实测范围另见任务报告，不把44个适配器等同44项Electron逐工具PASS。V1实际目录117项（75 WRITE、38 READ、4 DESTRUCTIVE），包含语义别名、分析、Forge和库工具，不能直接用工具数量衡量功能。

| 能力 | V1 | V2本轮 | 差异 / 复用路径 |
|---|---|---|---|
| 工程/合成信息、图层目录、选择、当前时间 | 支持 | 支持，宿主驱动READ | 原`registerReadTools`，按页目录；非模型多次自主READ协议 |
| 图层属性、关键帧、效果与遮罩身份 | 支持 | 支持，相关目标的有界详情 | 原`inspectLayer`/`inspectEffects`；原上下文器24属性/每属性8关键帧等限制仍在，不称任意深度完整查询 |
| 原生READ动态翻页/图节点依赖分析 | 支持 | 部分 / 未接入模型读取循环 | 当前只自动读取必要信息；需要再读取时不能假装已知 |
| Rectangle / Ellipse | 支持 | 支持，无选中创建 | `createShape`映射原createRectangle/createEllipse |
| Polygon / Star / Path | 支持 | 支持，审阅 | `createNative`→原createPolygon/createStar/createPath |
| Text /字体/大小/内容/颜色/对齐/字距/行距 | 支持 | 支持 | 原createText及文字工具；绝非光栅冒充Text |
| Image / Solid / Null | 支持 | 支持，审阅 | 原createLayer/createLayerFromAsset；Image仅已有素材，solid/null同原生kind |
| 相机/模型/音视频创建 | 不属于上述V1 createLayer工具的kind | 不新增 | 不凭SF GUI能力推断V1已有同等Agent工具；createLayerFromAsset也仅图像 |
| Position / Scale / Rotation / Opacity / Anchor | 支持 | 支持 | 复用原变换及支点补偿；旋转度数，缩放原数值，不实现第二套算法 |
| Fill / Gradient / Stroke / 尺寸 | 支持 | 支持 | 原setFill/setStroke/setLayerDimensions；描边仍仅Shape |
| 名称 / 顺序 / 可见性 / 父级 | 支持 | 支持 | 原renameLayer/reorderLayer/setLayerVisibility/setParent；仍受目标范围、父级循环等校验 |
| 新增 / 修改值 / 移动 / 删除关键帧、插值 | 支持 | 支持 | 原addKeyframe/moveKeyframe/setKeyframeValue/deleteKeyframe/setInterpolation；propertyId绑定目标所有权 |
| 运动曲线批量应用 / 复制 / 反转 | 支持 | 未对齐 | `applyMotionCurve/copyEasing/reverseEasing`尚无V2动作适配，CAPABILITY MISMATCH |
| Effect查询、添加、参数、启用、顺序 | 支持 | 支持 | 同effectKinds/Graph Command/参数校验，不复制效果算法 |
| Effect删除 | 支持、DESTRUCTIVE | 支持、必须审阅 | `removeEffect`隔离草稿→显式accept→同一次Undo可恢复 |
| Mask创建/模式/路径/羽化/扩张/透明度 | 支持 | 支持，结构操作审阅 | 同registerCompositingTools与Mask Command |
| 已导入Asset使用/替换、保存嵌入、Renderer | 支持 | 支持 | 无新文件系统进口，复用资产引用；真实透明PNG/Alpha/保存重载已验证 |
| Undo/Redo | 支持 | 支持 | 原CommandSystem；自然语言撤销仅匹配当前历史末笔，其他情况明确拒绝 |
| 复制/删除图层、预合成、跨合成管理 | 支持 | 未对齐 | CAPABILITY MISMATCH；组合成身份/受保护对象/破坏性授权与输出引用需要专门适配，未删除保护以强行开放 |
| TransformSelection、工作区Pivot/Orientation | 支持 | 未对齐 | Workspace状态不进入Scene；V2同样保留原默认变换参数，不声称共享用户全部工作区状态 |
| 通用Graph连线/输出/布局/节点增删 | 支持 | 未对齐 | V2当前Effect/Mask不是完整Graph编辑能力 |
| Forge / Preset / 可复用程序化包 / 图像参考分析 | 支持 | 未对齐 | 依赖库、草稿/信任、额外渲染/分析端口，不能直接作为普通Scene命令放行 |

完整原目录与V2实际白名单见`docs/qa/v2-capability-unlock/capabilities.json`。部分V1语义别名（如createShape/placeAtCompositionCenter/animateLayerProperty）在V2由现有语义动作加原生工具完成，名称不同不自动判缺失。**全工具范围仍是 CAPABILITY MISMATCH；只在共同能力子集具备执行路径对照条件。**


证据目录：`docs/qa/v2-capability-unlock/`；执行脚本：`work/capability-unlock-qa/`。本轮付费 API 调用为0；离线输入不代表模型理解能力。历史 V2-7 报告及原始响应未改。
