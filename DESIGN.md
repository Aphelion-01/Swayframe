---
version: alpha
name: Swayframe
description: Professional desktop motion design interaction architecture.
colors:
  primary: "#94c9eb"
  background-primary: "#191b1e"
  background-secondary: "#222428"
  background-tertiary: "#2b2e33"
  text-primary: "#e0e3e8"
  text-secondary: "#b7bec8"
  text-muted: "#919aa6"
  selection: "#33495d"
  accent: "#94c9eb"
typography:
  body:
    fontFamily: system-ui, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  metadata:
    fontFamily: system-ui, sans-serif
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
---

# Swayframe Interaction Architecture Specification

## Product interaction philosophy

用户按任务预测入口：项目管理资源，场景管理对象，画布处理空间，属性面板编辑参数，时间轴处理时间，曲线处理运动，节点处理图像，助手处理 AI。保持专业桌面编辑器的密度和现有五区布局。功能先归属，再呈现；本轮不新增动画算法或第二套命令系统。

## Workspace responsibilities

| 区域 | 负责 | 不负责 |
|---|---|---|
| Project / 项目 | 工程、合成、素材、导入、重新链接 | 图层动画、空间变换 |
| Scene / 图层 | 对象、层级、父级状态、可见性、锁定、预合成身份 | 关键帧、效果参数 |
| Canvas / 画布 | 选择、绘制、移动、缩放、旋转、锚点、对齐、视口 | 文件、缓动、效果栈 |
| Inspector / 属性 | 当前对象的变换、外观、文字、结构、遮罩、效果、三维 | 全局文件管理 |
| Timeline / 时间轴 | 时间、入出点、时段、动画属性、关键帧 | AI、文件操作 |
| Motion Curve / Graph | 缓动、数值、速度、影响比例 | 新建对象、工程管理 |
| Compositing Graph / 合成节点 | Source、Mask、Color、Effects、Merge、Output | 场景层级 |
| Assistant / 助手 | AI、建议、计划、自动化及 Proposal | 替代属性/工具的主要入口 |
| Application Menu | 文件、编辑、图层、动画、视图、窗口、帮助 | 永久展示所有对象参数 |
| Command Palette | 搜索现有操作，尤其长尾命令 | 重写底层能力 |
| Context Menu | 当前对象/属性/关键帧/节点/素材的操作 | 万能菜单 |

## Feature placement rules

1. 高频 + 全局 → Primary UI / Top-level Toolbar。
2. 高频 + 特定上下文 → Contextual UI / Inspector / Direct Manipulation。
3. 低频 + 全局 → Application Menu 或 Command Palette。
4. 低频 + 上下文 → Context Menu、Popover 或明确命名的 Advanced Section。
5. Property Editing → Inspector；动画属性的时间呈现可进入 Timeline。
6. Temporal Editing → Timeline。
7. Spatial Editing → Canvas。
8. Scene hierarchy → Scene Outliner。
9. Processing flow → Compositing Graph。
10. Easing / velocity → Motion Curve / Graph Editor。
11. Project / application action → File / App Menu。
12. 多入口必须服务不同 workflow；不能为了发现性堆三个永久按钮。每个能力必须有明确 Primary Location。

分类使用 F1–F5（极高频到极低频）、G/O/P/T/K/C/N/A（全局/对象/属性/时间/关键帧/合成/节点/素材）、Always/Selection/Property/Keyframe/Tool/Mode-dependent。发现性 D0–D4；严重度 0–4。频率是设计判断，不冒充用户遥测。

## Permanent UI budget

- Global：应用菜单、工程/合成身份、命令搜索、导出、撤销/重做；播放只属于底部共享预览条。
- Canvas Toolbar：Select、Hand、Rectangle/Ellipse、Pen、Text；不得放保存、导出、关键帧、Blur、Parent、Motion Curve。
- Scene Header：名称/数量和一个明确的“创建对象”入口；结构性操作放对象右键，禁止常驻关键帧/效果按钮。
- Project Header：新合成、导入（素材库所属）；不能将所有对象创建类型塞入文件菜单。
- Timeline Header：Playback、Current Time、Loop、Snap、Graph/Nodes tabs与常驻合成时间标尺。Footer：必要搜索/属性筛选/Zoom/Fit duration。Copy/Paste/Delete/Ease/关键帧导航不占永久按钮。
- Inspector：常用变换默认展开；外观、效果/遮罩、结构按任务分区，入口标题始终可见。语义、三维高级参数渐进展开。
- Graph：上下文工具条 + 主要图区 + 可折叠 Inspector + 共享预览条；不重复 Timeline 工具栏。
- Secondary Actions：优先右键、菜单、搜索、快捷键。新增永久入口必须在 Matrix 写明任务、频率和不能复用的原因。

## Context menu rules

空白 Scene/Timeline 右键可创建；对象右键直接显示对象操作，不能先要求进入创建菜单再点“操作”。Canvas 对象含复制、删除、对齐、预合成；Scene 对象含改名、父级、可见性、锁定、预合成；Timeline 对象另含拆分/时间属性。Keyframe 含插值、Ease、Curve、复制/删除；Property 含记录、移除动画、Graph。Node 含节点/连接操作，Asset 含使用、重新链接、删除。不能暴露未实现的 Group、Reveal、Expressions、Grid 等假入口。

## Menu architecture

文件：工程新建/打开/保存/另存、合成新建/设置、导入、导出、设置；桌面继续保留最近工程、关闭/退出。
编辑：撤销/重做、剪切/复制/粘贴/副本/删除/全选。
图层：创建对象（当前已有类型）、结构操作、父级、三维、对齐。
动画：记录选中属性关键帧、插值/缓动、曲线、前后关键帧。
视图：适应、实际尺寸、缩放。
窗口：项目/图层/助手、属性、时间轴/曲线/节点，恢复工作区。
帮助：操作指引、快捷键、关于。
菜单与搜索使用同一 Editor Action 集合；桌面菜单桥接同一入口，不实现第二套业务操作。选择相关操作必须禁用或给出明确选择提示。

## Inspector architecture

保留现有 AnimatedField / NumberField；变换、外观/几何、文字、父子级、图层时间、效果/遮罩、三维/摄像机分别归属。Effects 与 Structure 核心入口不藏在语义/高级部分。Effects 区域能直接进入合成节点，节点属性能返回图层属性。编辑参数只调用原 Command/Transaction。

## Timeline architecture

共享选择、时间、唯一播放时钟。图层轨道呈现时段和动画属性，关键帧是菱形。拆分在图层右键，Ease/复制/粘贴/删除在关键帧右键和动画/编辑菜单；导航保留 J/K。动画属性行保留秒表与记录菱形。

## Scene architecture

图层列表显示名称、类型、可见性、锁定与父级身份。对象右键直接进入结构菜单。空白区域与显式创建按钮统一使用带类型图标的列表式创建菜单，禁止饼菜单；右键覆盖整个图层工作区。合成导航属于 Project；预合成具有进入与返回父合成路径。

## Canvas architecture

工具模式持续、创建与选择有明确视觉状态。空间参考系、支点和吸附留在 Canvas；上下文对齐复用现有命令。视口状态不修改 Project。

## Graph architecture

曲线与动画数据共用；只有存在属性/关键帧才显示真实曲线。中间关键帧 Incoming/Outgoing 的区间语义不改变。Fit/缩放/平移为 UI 状态，空格预览仍使用共享时钟，参数拖动只提交一次历史。

## Assistant architecture

助手是明确标签和工具条入口，保留草稿、失败恢复、图片拖入/粘贴和能力提示。服务配置属于设置。Proposal 明确展示修改与应用动作；Intelligence 只输出 Proposal，复杂操作通过 Transaction。

## Shortcut philosophy

高频快捷键优先；Cmd/Ctrl+K 搜索，V/H/R/E/P/T 工具，Cmd/Ctrl+S 保存，Z/Shift+Z 撤销/重做，C/V/X/D/A 编辑，Delete 删除，Cmd/Ctrl+0 适应，J/K 关键帧导航，Shift+F3 Graph。全局快捷键使用 Shortcut Registry；模式特有按键同样通过 dispatchShortcut 和 FocusContext，输入框和中文 IME 优先。Pointer、keyup 释放、输入框原生键盘行为不属于全局命令，保留组件所有权。

## Progressive disclosure

用有意义的 Section 标题降低深度，不把全部功能藏进 More。Inspector 显示对象相关 Section；高级语义默认折叠，Camera/3D 参数仅相关时展开。菜单子级最多一层对象类型/对齐/插值；搜索可直达叶子操作。

## Undo semantics

GUI/Agent 统一 Command System；多对象/复杂 AI 操作使用 Transaction。连续数值和曲线手势：预览不入历史，松手一笔，Esc 回滚。UI 布局、面板选择、视口和命令搜索不进入 Scene 或 Undo。

## Selection model

沿用 EditorStore 的 Layer/Property/Keyframe/Graph selection，不添加菜单专用选择模型。右键对象先选择目标，保留已有多选；图层结构操作不能因残留关键帧选择而删除错误对象。记录关键帧优先 selectedProperties，再使用选中对象 Position，并遵守 locked。

## Design tokens

规范值源：`src/ui/design-tokens.css`。背景 #191b1e/#222428/#2b2e33，文字 #e0e3e8/#b7bec8/#919aa6，选中 #33495d，accent #94c9eb。间距 2/4/6/8/12/16/24/32；控件26px、标题32px、图标16px、正文12px、metadata11px、圆角3px/popover6px、过渡120ms。禁止另造视觉主题；数据轴/图层颜色独立于 UI selection。

## Accessibility

菜单有名字、键盘方向导航、Esc/外部关闭、焦点返回；弹窗焦点圈定。按钮有可读标签/tooltip，禁用状态符合真实能力；不以颜色作为唯一状态。窄窗口优先减少工程标题、滚动菜单条/面板，不整体缩放。尊重 reduced-motion。桌面密度采用24–28px控件，触摸44px不作为桌面强制尺寸。

## Anti-patterns

禁止功能实现后随意找地方加 Button；禁止同一功能在多个地方永久展示；禁止高频功能藏深层菜单；禁止低频功能霸占一级界面；禁止 Canvas / Scene / Inspector / Timeline 职责混用；禁止 UI 组件直接修改 Scene Model；禁止为了“容易发现”无限增加入口；禁止添加底层不存在的功能菜单；禁止将内部核查等同真人可用性研究。


## 0.9.13 interaction update

缓动是曲线编辑器内的功能，取消独立顶级Tab；所有底部模式保留同一合成时间标尺、播放头、播放控制与唯一时钟。3D快速开关属于Scene对象行；父子级快速设置属于图层菜单和Inspector。3D位置默认轴不联动。Canvas允许显式打开旁侧空间视图：中键绕转、Shift中键平移、滚轮缩放、F聚焦、正交方向快捷切换；观察状态不写Scene。XYZ拖动必须预览、一次Transaction、Esc取消。网格、参考线、标尺只辅助编辑，不进入最终渲染；以合成像素标注，自适应刻度，不依赖屏幕DPI猜尺寸。
