# Swayframe 0.9.11 · Graph Editor UX Result

执行基线：`docs/baseline/V02_GRAPH_EDITOR_UX.txt`。本轮仅调整曲线工作区的布局、选择、精确参数和导航，没有新增动画算法。

## Before problems

- P0：未发现需要重建动画模型的结构问题。
- P1：旧版 Graph 上限 720px，且以高度计算 maxWidth；大窗口把主要空间交给参数区。标准化缓动仍为浮动长面板；Timeline 搜索/过滤/缩放与曲线控件重复。
- P2：Value/Speed 使用下拉框；分量叫 X/R；一个区间也显示区间菜单。关键帧为圆点，参数没有选择上下文；中间关键帧容易混淆前后区间。
- P3：播放/关闭按钮和预览 slider 占据过多空间；图放大后标记、文字与网格粗细不统一。

## New layout

Graph Editor 与 Motion Curve 复用 `CurveWorkspace`：32px Context Toolbar → 中央 Graph + 默认250px Inspector → 36px Preview Bar。Graph 填满剩余宽高，没有最大绘图宽度或宽高比限制。纵轴padding依据真实变化范围计算，0.01这样的微小变化也会展开，不沿用最小1单位padding压扁小数属性。Inspector 可折叠、拖宽或用分隔条方向键调整；偏好单独持久化，两个曲线模式共用。曲线模式的 dock 至少220px高，参数纵向滚动，防止低高度下只剩一条不可编辑的图。

底部标签为「时间轴 / 曲线编辑器 / 缓动曲线 / 合成节点」，活动模式明确。标准化缓动不再悬浮遮挡画布。原工程、合成与左右面板布局保持。

本地浏览器四尺寸检查（先将 dock 增高，验证 resize；默认 Inspector 250px）：

| 窗口 | Graph 尺寸 | Inspector 宽度 | Toolbar / Preview | 页面横向溢出 |
|---|---|---|---|---|
|1280×720|1025×295|250|32 / 36px|无|
|1440×900|1185×431|250|32 / 36px|无|
|1920×1080|1665×431|250|32 / 36px|无|
|2560×1440|2305×431|250|32 / 36px|无|

实测1280宽折叠 Inspector 后 Graph 宽1280px；鼠标拖宽参数栏250→280px有效。截图、读出的几何数据在 `outputs/graph-editor-ux`，四张布局截图实际分辨率与目标窗口一致。

## Removed controls

删除独立的大播放/关闭按钮、散落的 Ease 按钮、跨参数栏的预览 slider、重复的 Timeline 搜索/过滤/缩放。返回 Timeline 改为小图标或标签。Value/Speed 改 segmented；仅一个分量/区间时隐藏相应选择器，空 Motion Curve 不显示空区间菜单。

## Changed interactions

- Property 继承 Timeline 属性/帧选择；X/Y/Z 与 R/G/B/A 根据属性显示。Graph 点击关键帧同步全局 frames，Shift/Ctrl/Cmd 可追加。值/速度切换保留选区。
- 小菱形表示关键帧，选中填充；小圆点表示手柄，透明描边扩大命中区。标记和刻度按屏幕像素换算，网格与控制线保持细线。
- Inspector 无选择显示图表设置；关键帧显示 Time / Value / Interpolation 和存在的入/出参数；区间显示 X1/Y1/X2/Y2；手柄只显示对应侧的 Speed / Influence。
- 三关键帧选择中间帧时 Incoming 修改前一区间、Outgoing 修改后一区间。末尾帧没有 Outgoing 控件。数值输入和拖动实时预览，释放提交一次事务；颜色数组保留数组结构及其他通道。
- 关键帧右键提供 Ease、Linear、Hold、Copy、Paste、Delete；区间右键提供 Motion Curve、Reset Easing、Copy Easing。右键点中的区间通过 segmentId 精确传递到缓动面板。
- F 适应全部；Fit Selected 按选中关键帧的时间和值范围居中缩放；Reset View 只重置平移/倍率，保留当前冻结的取值范围。滚轮围绕鼠标缩放，Shift滚轮横移，空格拖动/中键平移；1/2 切换值/速度视图。
- 底部 icon 播放/暂停、停止、Loop、mini scrubber 与 Timeline 共用时间和播放状态；空格轻按播放，按住拖动平移。标准化缓动同样支持导航和直接播放。
- 无动画属性显示选择提示；零帧没有假曲线；单帧显示可选菱形及关键帧参数，并提示添加第二帧，曲线控件禁用。

## Animation data compatibility

仍直接读取 `Property<AnimValue>`、原 Keyframe、Interpolation 和 Motion Segment。没有 GraphCurveData、第二份 Scene、第二套合成 currentTime 或播放时钟。Project schema、动画求值、Spring/Bounce 等已有插值和渲染行为没有改写。Value/Speed 同源，标准化缓动经既有 `applyMotionCurveCommands`；关键帧精确修改经 `keyframe.update` / Command System。GUI 与 Agent 命令边界保持。

预览在 EditorView 临时 Property 中，Canvas 通过原 `getRenderProject()` 读取；Mouse Up 提交一笔 Transaction，Esc / 失焦 / PointerCancel 清除预览。Fit / Zoom / Pan / 折叠 / Resize 不进工程或 Undo；保存再打开保留原动画数据。

## Performance impact

两个曲线视图改为字段选择订阅。临时 Property 变化只更新相关曲线、Inspector 与 Canvas，静态 Timeline 树不订阅预览字段。监听器不再随每次曲线预览重新挂载。没有 pointermove 保存工程、JSON 序列化 Scene 或重建 Timeline 的路径。

自动测试分别对 Graph 与标准化缓动发送200次 pointermove：期间 Project 不变、Undo不增长、Canvas求值的临时 Property 改变；窗口释放仅新增一笔事务，Undo恢复起始数据。Graph 仍使用既有201点采样，未添加新的采样算法、虚拟化或引擎。

真实浏览器鼠标拖动后，0.5秒的位置X由50变为34.919，历史只增加一步；Undo一次恢复50。曲线内直接播放，时间与画布属性同时变化；暂停有效。

## Known issues

- 本轮没有测量真实绘制 FPS；200次手势测试证明状态和撤销语义，不代表性能基准。
- 极端缩放下坐标标尺继续随视口移动；未改为固定轴的无限动态刻度系统。
- Graph 区间右键需命中实际曲线，当前没有扩大整段曲线的透明命中带。
- 已有 Web 主入口大于500kB的构建提示仍存在，不影响本轮构建；没有为曲线UI改动重做全局代码拆包。
- 安装包签名、平台运行边界以 `outputs/graph-editor-ux/verification.json` 为准；浏览器验收不替代 Windows 原生验收。

## Deferred

独立X/Y轴缩放、All Components叠加显示、固定标尺/自适应刻度与曲线采样缓存延后。用户明确允许本轮采用 Fit + general zoom；单分量是第一版范围。没有加入 Spring Engine、Bounce Engine、Expressions、AI Motion Agent、动画市场、新动画属性或高级 Timeline 功能。

## Tests

`tests/graph-editor-ux.test.tsx` 覆盖A～G（部分合并为同一测试）：2帧缓出、3帧入/出归属与实时预览、模式共享选区、单帧/空状态、属性栏偏好、鼠标中心缩放/横移/Fit、200次手柄预览与一次Undo；另测关键帧精确值、Hold菜单、RGBA类型、Linear清除切线及精确Motion区间路由。保留并更新已有Graph/Timeline/Motion回归，旧测试按新UI操作，不保留隐藏旧控件。

最终门禁：108个测试文件 / 397项测试通过；lint、typecheck、Web及desktop build通过。`npm run desktop:build`包含 TypeScript检查。安装包归档与构建文件逐字节比较结果单独写入 verification.json。

## Final Graph Editor component hierarchy

```text
Workspace
└─ Timeline（唯一合成播放时钟、loop、模式标签）
   ├─ GraphEditor（原Property/Keyframe选择、手势、Command提交）
   │  └─ GraphFrame
   │     └─ CurveWorkspace
   │        ├─ Context Toolbar（Property / Component / Value-Speed / Ease / Fit）
   │        ├─ Main
   │        │  ├─ Curve Canvas（SVG / Grid / Curve / Diamonds / Handles / Playhead）
   │        │  ├─ Inspector divider
   │        │  └─ Curve Inspector（key / segment / handle / settings）
   │        └─ Preview Bar（Playback / Loop / Scrubber / Time / Zoom）
   └─ MotionCurvePanel（既有Motion Segment与apply/preview命令）
      └─ CurveWorkspace（同一布局与Inspector偏好）
         ├─ Context Toolbar（范围 / 区间 / Ease / Fit）
         ├─ Main（Normalized SVG + 精确坐标Inspector）
         └─ Preview Bar（共享合成Playback / Scrubber / Zoom）

共享：useSvgMetrics / useCurveNavigation / usePointerRelease /
      useInteractionCancel / NumberField / IconButton / ContextMenu
```
