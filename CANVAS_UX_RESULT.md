# Canvas Interaction / Direct Manipulation · 0.9.8

基线 0.9.7（1f1a06f）；任务见 `docs/baseline/V02_CANVAS_INTERACTION.txt`。本轮只修改画布和直接共用的命中、坐标、属性预览、历史入口。

## Implemented

- 轻量互斥 Pointer Interaction：marquee / drawing / moveSnap / gesture（scale、rotate、anchor）/ pan；同一时刻只有一个载荷。文本/路径为独立编辑上下文，Esc、失焦、Pointer Cancel 清理临时预览。已有 ToolProvider 继续作为工具唯一来源。
- CSS 屏幕坐标↔合成坐标↔图层局部坐标函数；父级、旋转、负缩放通过真实矩阵换算。指针计算不乘 devicePixelRatio。
- 合成外围留白也可框选；反向拖动、Shift 追加使用相同世界边界相交规则。隐藏、透明、时间范围外、锁定层不参与选择；顶层锁定对象不阻挡后方可编辑对象。
- 对象 hover 轮廓；八个 6 CSS px 缩放手柄、16 CSS px 命中区域及角外旋转区域；方向光标跟随参考轴。
- Alt/Option 起始复制拖动：拖动期间只有临时副本，释放时创建与移动合为一次 Transaction，Esc 不留下副本。选中父子时重映射复制后的父级引用。
- 基础等间距 Smart Guide：相邻且横向范围重叠的两个对象之间可等间距吸附，显示两段实际距离。与已有合成/图层中心、边缘吸附共用屏幕 6 px 容差；Ctrl/Cmd 临时关闭。
- 预合成双击进入、父级面包屑返回。多选 Inspector 属性不同时显示“—”；共同 Move / Scale / Rotate 继续通过共享变换 Transaction。

## Improved

角手柄默认等比，Shift 临时解除；边手柄默认单轴，Shift 临时等比。Inspector XY 链接不再改变边手柄语义。负缩放越过支点后保持对应轴符号。Shift Move 的方向首次确定后保持，释放 Shift 恢复自由移动。

旋转按相邻指针角累积，可连续跨过 180°/360°并保留多圈角度；Shift 仍为 15°。Anchor Move 补偿 Position，保持二维画面矩阵不变，包括旋转、非均匀缩放和旋转缩放父级。

Move / Scale / Rotate / Anchor 的 Inspector 在临时预览期间更新，Scene 不变；释放后只产生一笔操作。键盘连续 repeat 微调仅合并同次按住、同选区/时刻、相邻且标签一致的历史；keyup/blur 分开下一次操作，Undo/Redo 保留原始命令顺序。

25% / 50% / 100% / 200% / 400% 现为真实 CSS 像素倍率，Fit 单独存在。Ctrl/Cmd + Wheel 以指针为中心；快捷键支持 Fit、Actual Size、增减倍率。手动模式调整面板尺寸保持真实倍率，Fit 模式重新适应。Space、中键、Hand 平移不改 Scene，不清除选区。

## Deferred

- 更复杂的重复间距推导、跨行排版、距离标签交互编辑；本轮已有基础两侧等间距。
- 精确图片 alpha、逐字形轮廓、任意路径填充/描边逐像素命中；目前文本/路径用真实测量边界。预合成作为整体命中，内部对象通过进入预合成编辑。
- 三维直接移动锚点、高级三维 Gizmo；保留原投影选择与原三维能力。
- 长时间大工程操作及 Windows 125%/150%/200% 真机验证；当前不具备 Windows 运行环境。

## Known bugs / limits

- 矢量蒙版命中使用几何近似；矩形/椭圆羽化按软边范围扩张，Bezier 使用固定细分，任意路径的 expansion/feather 尚未精确纳入命中。投影三维图层仍按 quad 命中，不做蒙版可见区精确判定。
- 全局非等比变换若产生现有 TRS 模型无法表达的剪切，会提示改用局部轴或等比缩放；不静默近似、不改变工程模型。
- 2560×1440 的 DOM 布局与视口一致，但当前浏览器截图后端只返回 2512 px 宽且绘制捕获异常，不能将该截图当作完整大屏视觉验收。1280、1440、1920 截图正常。
- 已跑场景内没有遗留阻塞错误；上述限制不等于经过无限场景验证。

## Performance observations

Canvas 从整个 EditorView 订阅改为相关字段订阅；App 已有选择性订阅继续保留，预览不会因状态文字或节点选择而让整个应用树重绘。临时 Move 使用 PositionPreview；Scale/Rotate 保留起始快照，未变图层引用及既有求值缓存复用。候选吸附点和相邻间距在 pointerDown 冻结，而非每次移动重建。

每次 pointermove 不保存 Project、不 JSON.stringify、不提交 Command。Alt 复制预览会建立浅层合成视图，但不克隆整个 Scene。100 次连续移动/缩放只提交一笔历史已有回归覆盖。未做真实 FPS/React Profiler 定量采样，测试耗时不当作帧率；复杂蒙版仍可能增加命中成本。

## Tests

完整质量门禁：lint、TypeScript、104 个文件 / 360 项测试、生产 Web 与桌面构建；最终准确数量见 `outputs/canvas-ux/verification.json` 和 `tests.log`。安装包为 0.9.8，归档内容另行与本地 dist/desktop-dist 校验。

| 场景 | 证据与结论 |
| --- | --- |
| A | UI 事件创建矩形→Move→Scale→Rotate→Anchor，5 次 Undo 到空白，5 次 Redo 精确恢复；通过 |
| B | Rectangle/Ellipse/Text Shift 多选，整体 Move/Scale/Rotate，逐笔 Undo 精确恢复；通过 |
| C | 合成与图层中心/边缘吸附、Ctrl 临时关闭；新增两侧等间距及距离线测试；通过 |
| D | 25/50/100/200/400% 坐标、拖动、16px 手柄命中与 6px 吸附测试；通过。真实 UI 对应画布宽 480/960/1920/3840/7680 |
| E | 左上/右下两处 WheelEvent 测试，光标下合成点保持；通过。该项是模拟布局测试，未冒充真机滚轮实测 |
| F | Space-pan 释放回到原工具、选区不丢、输入框 Space 不抢快捷键；通过。真实 UI 另验证 Hand 平移 50/40 CSS px |
| G | 100 次 pointermove，Scene 在预览期间不变，释放一笔 Command，Undo 回到原位；通过 |

额外覆盖：连续多圈旋转、负缩放、Alt 复制与取消、Pointer Cancel、锁定层穿透、反向框选、混合属性值、数值实时预览、键盘 repeat 合并、手动倍率 resize、父级变换后的锚点视觉不变。

真实源代码界面验收：鼠标拖矩形后 Position 从 551.232/408.778 到 1089.085/580.895，Undo 一次恢复；边手柄拖动 X=172.727%、Y=100%；Undo 后旋转为90°；Hand 平移选区保持；真实界面新增两个矩形并将第三个拖到两侧等间距位置，结果图见 equal-spacing-result.jpg。截图 `outputs/canvas-ux/final-canvas.jpg`、`viewport-1440.jpg`、`viewport-1920.jpg`。浏览器错误日志为空。未调用付费模型。

## 下一轮 Timeline 专项：优先审计的 10 个问题

以下为具体审计目标，未在本轮扩展实现，也不预先断言每项都是现存缺陷。

1. 播放头拖出面板后的捕获、自动滚动、释放与 Esc 取消一致性。
2. 多选关键帧横向移动时，相对时间间隔、帧吸附与越界处理。
3. 关键帧框选、Shift 追加/取消与 Canvas 图层选区的焦点边界。
4. 重叠关键帧的可见反馈、命中顺序与精确选择。
5. 图层条带裁切、移动、关键帧时间和 startTime 的关系。
6. Timeline 缩放以指针/播放头为中心，横滚与竖滚互不误触。
7. 属性展开/折叠、筛选、多选与滚动位置保持。
8. 长图层列表/大量关键帧的渲染与播放时重绘成本。
9. 连续拖动、复制粘贴、批量删帧的 Transaction 与 Undo 粒度。
10. 时间标尺、帧号/秒、插值与曲线入口在不同 fps 下的数值一致性。
