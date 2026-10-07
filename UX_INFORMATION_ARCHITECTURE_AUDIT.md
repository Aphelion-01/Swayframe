# Feature Entry Inventory

审计基线 db86a03 / 0.9.11，2026-10-07。扫描真实 UI、desktop renderer 和 Electron menu。下表是代码入口全量索引，不把截图当功能清单。动态对象/属性/关键帧/节点的重复实例按组件族记录；显示表达式保留用于复核。Frequency 为专家判断，未做用户遥测；D 是首次定位难度，未作真人研究。

F1 极高频 / F2 高频 / F3 中频 / F4 低频 / F5 极低频。G/O/P/T/K/C/N/A 分别全局/对象/属性/时间/关键帧/合成/节点/素材。D0 明显到 D4 几乎隐藏。Depth 为点击到控件的典型深度，拖拽和键盘视作0–1，不代表所有条件分支。

## Heuristic audit before

| Issue | Evidence | Severity | Recommendation |
|---|---|---|---|
| IA-01 对象右键先创建再操作 | LayerPanel + Timeline: CreatePieMenu items → 操作 | 3 | 对象直接结构菜单，空白保留创建 |
| IA-02 全局菜单单一文件分类 | Toolbar 文件只含工程/设置，编辑/图层/动画不在Web菜单 | 3 | 七类标准菜单共享操作 |
| IA-03 搜索未覆盖真实能力 | Toolbar palette仅五类对象，缺camera/polygon/star/solid及大量全局操作 | 3 | 搜索全局和上下文操作，叶子直达 |
| IA-04 父级、效果、遮罩在关闭的Section | Inspector 层级与时间/效果与遮罩 open=false | 3 | 任务分区、核心入口默认展开 |
| IA-05 图层操作混空间对齐/结构/创建 | layerActions所有表面同一个万能集合 | 2 | Scene/Timeline/Canvas上下文过滤 |
| IA-06 顶部播放与时间轴播放重复 | Toolbar 播放预览 + Timeline playback | 2 | 保留底部唯一预览操作 |
| IA-07 节点只能底部Tab，效果与节点工作流断开 | CompositingControls 无打开按钮 | 3 | 效果区直达节点，打开时展开dock |
| IA-08 Timeline footer关键帧杂项常驻菜单 | Copy/Paste/Delete/next-frame clone导航混合 | 2 | 关键帧右键、编辑/动画菜单、J/K |
| IA-09 合成和面板缺全局可见导航 | 只有doubleclick、隐藏面板toggle | 2 | 窗口菜单带目标名称、显式打开 |
| IA-10 Help无任务指引/快捷键 | 原生仅About、Web仅搜索icon | 2 | Help任务路径+Registry快捷键 |

无已确认 Severity 4。Before Quick Diagnostic：导航、主操作、辨识负担失败（最严重3），指引不足（2）；按Skill权重初评3/10，是启发式评级，不是用户满意度。

## Dynamic feature families / Alternative entries / Related features

| Family | Actual instances | Alternative / shortcut | Related / problem |
|---|---|---|---|
| Canvas tools | select hand rectangle ellipse pen text | V H R E P T；菜单对象创建；空白饼菜单 | drawing / spatial；高级对象创建仅右键 |
| Layer kinds | rectangle ellipse polygon star path text camera solid null image；precomp由预合成或嵌套合成 | 右键创建；palette原本缺多数 | Project / Scene / Canvas |
| Transform | position scale rotation opacity anchor；Vec2/Vec3联动；scalar无链接 | Inspector + animated Timeline + Graph；P/S/R/T/U轨道筛选 | property previews / Undo |
| Shape / text | dimensions strokeColor strokeWidth gradient gradientEndColor join cap polygonSides starInnerRadius pathFill closed / font size family weight tracking lineHeight align | AppearanceControls；PathEditor | 按真实对象类型显示 |
| Structure / temporal | parent precompose enter-precomp 3D visibility lock rename reorder；inPoint outPoint split | Scene右键更多操作、Inspector折叠、Timeline拖动/右键 | 结构与时间混淆 |
| Keyframes | animation toggle add delete move multi select copy paste duplicate-next-frame linear hold bezier spring(原存量) ease-in/out/both prev/next | property row / keyframe右键 / Graph / Motion；J/K Cmd/Ctrl+C/V/D Delete | 不新增Spring能力 |
| Graph | property/component value/speed incoming/outgoing velocity/influence cubic coords FitAll/Selected Reset wheel/pan context | Timeline tab / property/keyframe context；F/Home 1/2 Space | 共用selection/time |
| Motion Curve | quick presets, library29 builtin/custom favorite recent rename duplicate delete import/export, scope segments, both/in/out reverse/mirror/reset copy/paste | 缓动Tab、选区context、preset browser | 标准化区间，与Graph共享数据 |
| Spatial/path | path point/add/delete smooth/corner closed tangent fit animation/time | Inspector path editor、Graph spatial section | 不混用时间缓动 |
| Effects | brightnessContrast exposure hueSaturation temperature tint levels gaussianBlur dropShadow glow tintFill | effects type registry select、node search、palette blur | 下表控件族逐参数实例化 |
| Masks/blend | rectangle ellipse path mask / enable mode opacity feather expansion delete edit path；7 blend modes | Inspector / 节点处理流 | 分支图不能作为线性效果栈编辑 |
| Nodes | source output passthrough solid transform mask merge + effects；add connect reconnect disconnect duplicate delete layout enable/rename align search | node Tab search、node/edge/context；F Home Space Ctrl/Cmd+D Delete | node inspector parameters animated |
| Project/assets | new/open/save/saveAs recent/recovery/newComp/settings/import/addAssetLayer/relink/delete/nestedComp | native menu、Project assets、drop；Ctrl/Cmd+N/O/S/ShiftS | relink只在native linked媒体 |
| Export | current PNG / range sequence / cancel / progress | 顶部export、palette、native file menu | 同一renderer |
| Assistant/settings | provider/model/vision/routes/limits/headers/retry/skills；chat/plan/stop/apply/undo refs drop/paste history motion presets proposals | Assistant tab/toolbar、File settings、palette | 错误保留文本，Proposal validated transaction |
| Workspace/help | panel resize/collapse/tabs/fit actual zoom；about startup recovery recents | icons、Tab、native菜单；Ctrl/Cmd+0/1/=/− | layout UI-only |

## Code entry ledger

Alternative Entry Points / Shortcut / Related Features 对照上面的功能族及 FEATURE_LOCATION_MATRIX.md。每个 ID 保留原始文件位置，即使本轮迁移后行号变化也可用基线复核。

| ID | Feature / expression | Current Location | Depth | Frequency | Scope | Context Dependency | Discoverability | Current IA Fit | Problems |
|---|---|---|---|---|---|---|---|---|---|
| E-0001 | '退出' | Application / Workspace · apps/desktop/electron/menu.ts:34 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0002 | '文件' | Application / Workspace · apps/desktop/electron/menu.ts:43 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0003 | '最近工程' | Application / Workspace · apps/desktop/electron/menu.ts:53 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0004 | '暂无最近工程' | Application / Workspace · apps/desktop/electron/menu.ts:60 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0005 | '关闭窗口' | Application / Workspace · apps/desktop/electron/menu.ts:65 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0006 | '退出' | Application / Workspace · apps/desktop/electron/menu.ts:69 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0007 | '编辑' | Application / Workspace · apps/desktop/electron/menu.ts:73 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0008 | '视图' | Application / Workspace · apps/desktop/electron/menu.ts:87 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0009 | '动画' | Application / Workspace · apps/desktop/electron/menu.ts:101 (Menu / Registry) | 1 | F3 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0010 | '窗口' | Application / Workspace · apps/desktop/electron/menu.ts:109 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0011 | '帮助' | Application / Workspace · apps/desktop/electron/menu.ts:119 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0012 | 新建工程 | Application / Workspace · src/desktop/DesktopApp.tsx:80 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0013 | 打开工程… | Application / Workspace · src/desktop/DesktopApp.tsx:87 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0014 | {recent.displayName} | Application / Workspace · src/desktop/DesktopApp.tsx:98 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0015 | {移除最近工程 ${recent.displayName}} | Application / Workspace · src/desktop/DesktopApp.tsx:108 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0016 | 丢弃恢复版本 | Application / Workspace · src/desktop/DesktopApp.tsx:146 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0017 | 恢复工程 | Application / Workspace · src/desktop/DesktopApp.tsx:157 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0018 | 关闭 | Application / Workspace · src/desktop/DesktopApp.tsx:183 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0019 | "Agent 模式" | Assistant / Settings · src/ui/AgentPanel.tsx:139 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0020 | "Agent Skill" | Assistant / Settings · src/ui/AgentPanel.tsx:151 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0021 | 管理 | Assistant / Settings · src/ui/AgentPanel.tsx:171 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0022 | 配置 AI 服务 | Assistant / Settings · src/ui/AgentPanel.tsx:193 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0023 | 停止 | Assistant / Settings · src/ui/AgentPanel.tsx:208 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0024 | 对话 · {session.conversation.length} | Assistant / Settings · src/ui/AgentPanel.tsx:213 (summary) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0025 | 确认并执行计划 | Assistant / Settings · src/ui/AgentPanel.tsx:240 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0026 | { canUndo ? '通过共享历史撤销整次操作' : '当前没有可直接撤销的 Agent 操作；后续编辑可使用全局撤销' } | Assistant / Settings · src/ui/AgentPanel.tsx:280 (button) | 1 | F2 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0027 | 操作记录 · {session.toolCalls.length} | Assistant / Settings · src/ui/AgentPanel.tsx:298 (summary) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0028 | 查看修改前后 | Assistant / Settings · src/ui/AgentPanel.tsx:316 (summary) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0029 | 会话历史与动画预设 | Assistant / Settings · src/ui/AgentPanel.tsx:328 (summary) | 1 | F3 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0030 | 新会话 | Assistant / Settings · src/ui/AgentPanel.tsx:330 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0031 | 清除当前工程历史 | Assistant / Settings · src/ui/AgentPanel.tsx:336 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0032 | {h.summary} | Assistant / Settings · src/ui/AgentPanel.tsx:350 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0033 | "Agent 动画预设名称" | Assistant / Settings · src/ui/AgentPanel.tsx:363 (input) | 1 | F3 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0034 | 保存当前图层动画为预设 | Assistant / Settings · src/ui/AgentPanel.tsx:370 (button) | 1 | F2 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0035 | 用于下次请求 | Assistant / Settings · src/ui/AgentPanel.tsx:393 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0036 | 删除预设 | Assistant / Settings · src/ui/AgentPanel.tsx:407 (button) | 1 | F3 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0037 | "添加 Agent 参考" | Assistant / Settings · src/ui/AgentPanel.tsx:444 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0038 | "参考模式" | Assistant / Settings · src/ui/AgentPanel.tsx:460 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0039 | {'移除参考 ' + ref.name} | Assistant / Settings · src/ui/AgentPanel.tsx:487 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0040 | "Agent 需求" | Assistant / Settings · src/ui/AgentPanel.tsx:507 (textarea) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0041 | 发送 | Assistant / Settings · src/ui/AgentPanel.tsx:532 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0042 | {label} | Inspector · src/ui/AnimatedField.tsx:208 (AxisLinkButton) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0043 | {${property.keyframes.length ? '关闭' : '开启'}${label}动画} | Inspector · src/ui/AnimatedField.tsx:210 (button) | 1 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0044 | {记录${label}关键帧} | Inspector · src/ui/AnimatedField.tsx:218 (button) | 1 | F2 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0045 | {${label}${unit}} | Inspector · src/ui/AnimatedField.tsx:229 (NumberField) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0046 | {label} | Inspector · src/ui/AnimatedField.tsx:247 (input) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0047 | {${label} HEX} | Inspector · src/ui/AnimatedField.tsx:261 (TextField) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0048 | {${label} 透明度（%）} | Inspector · src/ui/AnimatedField.tsx:277 (NumberField) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0049 | {${label} ${['X', 'Y', 'Z', 'A'][i] ?? i + 1}${unit}} | Inspector · src/ui/AnimatedField.tsx:298 (NumberField) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0050 | {${label} ${k.toUpperCase()}${unit}} | Inspector · src/ui/AnimatedField.tsx:321 (NumberField) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0051 | {key === 'width' ? '图层宽度' : '图层高度'} | Inspector · src/ui/AppearanceControls.tsx:85 (NumberField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0052 | "锚点" | Inspector · src/ui/AppearanceControls.tsx:100 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0053 | "描边颜色" | Inspector · src/ui/AppearanceControls.tsx:108 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0054 | "描边宽度" | Inspector · src/ui/AppearanceControls.tsx:114 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0055 | "填充渐变" | Inspector · src/ui/AppearanceControls.tsx:123 (select) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0056 | "渐变末色" | Inspector · src/ui/AppearanceControls.tsx:138 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0057 | {key === 'strokeJoin' ? '描边连接' : '描边端点'} | Inspector · src/ui/AppearanceControls.tsx:149 (select) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0058 | "边数" | Inspector · src/ui/AppearanceControls.tsx:175 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0059 | "星形内半径" | Inspector · src/ui/AppearanceControls.tsx:184 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0060 | "路径填充" | Inspector · src/ui/AppearanceControls.tsx:195 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0061 | 编辑贝塞尔路径 | Inspector · src/ui/AppearanceControls.tsx:201 (button) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0062 | "闭合路径" | Inspector · src/ui/AppearanceControls.tsx:203 (input) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0063 | "字重" | Inspector · src/ui/AppearanceControls.tsx:217 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0064 | "字距" | Inspector · src/ui/AppearanceControls.tsx:224 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0065 | "行距" | Inspector · src/ui/AppearanceControls.tsx:231 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0066 | "文字对齐" | Inspector · src/ui/AppearanceControls.tsx:240 (select) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0067 | 项目 / 素材 · {view.project.assets.length} | Project / Assets · src/ui/AssetsPanel.tsx:49 (summary) | 1 | F4 | A | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0068 | 导入到素材库 | Project / Assets · src/ui/AssetsPanel.tsx:50 (button) | 1 | F2 | A | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0069 | "素材库导入文件" | Project / Assets · src/ui/AssetsPanel.tsx:59 (input) | 1 | F2 | A | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0070 | 重新链接 | Project / Assets · src/ui/AssetsPanel.tsx:97 (button) | 1 | F4 | A | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0071 | {添加素材 ${asset.name}} | Project / Assets · src/ui/AssetsPanel.tsx:104 (button) | 1 | F4 | A | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0072 | {删除素材 ${asset.name}} | Project / Assets · src/ui/AssetsPanel.tsx:117 (button) | 1 | F3 | A | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0073 | "插入预合成" | Project / Assets · src/ui/AssetsPanel.tsx:132 (select) | 1 | F3 | A | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0074 | {返回合成 ${view.project.compositions.find((c) => c.id === id)?.name}} | Canvas · src/ui/Canvas.tsx:1244 (button) | 1 | F4 | O | Tool-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0075 |  | Canvas · src/ui/Canvas.tsx:1266 (button) | 1 | F4 | O | Tool-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0076 | "画布吸附" | Canvas · src/ui/Canvas.tsx:1273 (button) | 1 | F4 | O | Tool-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0077 | "画布文字编辑" | Canvas · src/ui/Canvas.tsx:1599 (TextField) | 1 | F4 | O | Tool-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0078 | 完成文字编辑 | Canvas · src/ui/Canvas.tsx:1615 (button) | 1 | F4 | O | Tool-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0079 | "缩放到所选图层" | Canvas · src/ui/Canvas.tsx:1653 (button) | 1 | F3 | O | Tool-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0080 | "画布缩放" | Canvas · src/ui/Canvas.tsx:1691 (select) | 1 | F3 | O | Tool-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0081 | "混合模式" | Compositing Graph / Effects · src/ui/CompositingControls.tsx:117 (select) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0082 | 遮罩 | Compositing Graph / Effects · src/ui/CompositingControls.tsx:132 (summary) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0083 | 添加 {{ rectangle: '矩形', ellipse: '椭圆', path: '路径' }[kind]} 遮罩 | Compositing Graph / Effects · src/ui/CompositingControls.tsx:135 (button) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0084 | {启用遮罩${i + 1}} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:150 (input) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0085 | {删除遮罩${i + 1}} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:160 (button) | 2 | F3 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0086 | {遮罩${i + 1}模式} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:173 (select) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0087 | 编辑遮罩 {i + 1} 路径 | Compositing Graph / Effects · src/ui/CompositingControls.tsx:185 (button) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0088 | {遮罩${i + 1}不透明度} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:188 (AnimatedField) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0089 | {遮罩${i + 1}羽化} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:195 (AnimatedField) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0090 | {遮罩${i + 1}扩展} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:202 (AnimatedField) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0091 | 效果与调色 | Compositing Graph / Effects · src/ui/CompositingControls.tsx:221 (summary) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0092 | "添加效果类型" | Compositing Graph / Effects · src/ui/CompositingControls.tsx:223 (select) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0093 | 添加效果 | Compositing Graph / Effects · src/ui/CompositingControls.tsx:234 (button) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0094 | {启用效果${i + 1}} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:251 (input) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0095 | {删除效果${i + 1}} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:261 (button) | 2 | F3 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0096 | {上移效果${i + 1}} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:271 (button) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0097 | {下移效果${i + 1}} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:278 (button) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0098 | {效果${i + 1}${spec?.label ?? key}} | Compositing Graph / Effects · src/ui/CompositingControls.tsx:289 (AnimatedField) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0099 | 创建合成节点图 | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:72 (button) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0100 | '添加节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:242 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0101 | '适应节点图' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:249 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0102 | '删除节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:256 (Menu / Registry) | 1 | F3 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0103 | '复制节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:263 (Menu / Registry) | 1 | F3 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0104 | '平移节点图' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:271 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0105 | ＋ 添加节点 | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:471 (button) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0106 | 适应视图 | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:472 (button) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0107 | "节点名称" | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:617 (input) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0108 | {${node.enabled ? '禁用' : '启用'}节点 ${node.name}} | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:651 (button) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0109 | {${node.name} ${side === 'input' ? '输入' : '输出'} ${port.name}} | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:675 (button) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0110 | '在连线上插入节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:756 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0111 | '断开连线' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:760 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0112 | '重命名节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:771 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0113 | '复制节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:780 (Menu / Registry) | 1 | F3 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0114 | '删除节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:785 (Menu / Registry) | 1 | F3 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0115 | '添加节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:792 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0116 | '适应所有节点' | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:795 (Menu / Registry) | 1 | F4 | N | Selection-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0117 | "搜索节点类型" | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:810 (input) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0118 |  | Compositing Graph / Effects · src/ui/CompositingGraph.tsx:841 (button) | 1 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0119 | 图层属性 | Compositing Graph / Effects · src/ui/CompositingNodeInspector.tsx:31 (button) | 2 | F3 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0120 | "节点名称" | Compositing Graph / Effects · src/ui/CompositingNodeInspector.tsx:34 (TextField) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0121 | "启用当前节点" | Compositing Graph / Effects · src/ui/CompositingNodeInspector.tsx:46 (input) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0122 | {spec?.label ?? key} | Compositing Graph / Effects · src/ui/CompositingNodeInspector.tsx:65 (AnimatedField) | 2 | F4 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0123 | 删除当前节点 | Compositing Graph / Effects · src/ui/CompositingNodeInspector.tsx:96 (button) | 2 | F3 | N | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0124 | "导出开始时间" | Application / Workspace · src/ui/ExportDialog.tsx:86 (input) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0125 | "导出结束时间" | Application / Workspace · src/ui/ExportDialog.tsx:97 (input) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0126 | 导出当前帧 | Application / Workspace · src/ui/ExportDialog.tsx:114 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0127 | 导出 PNG 序列 | Application / Workspace · src/ui/ExportDialog.tsx:117 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0128 | 取消导出 | Application / Workspace · src/ui/ExportDialog.tsx:127 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0129 | 关闭导出 | Application / Workspace · src/ui/ExportDialog.tsx:129 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0130 | "返回时间轴" | Motion Curve / Graph · src/ui/GraphEditor.tsx:200 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0131 | '曲线平移' | Motion Curve / Graph · src/ui/GraphEditor.tsx:593 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0132 | '适应曲线视图' | Motion Curve / Graph · src/ui/GraphEditor.tsx:604 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0133 | '曲线视图移动' | Motion Curve / Graph · src/ui/GraphEditor.tsx:612 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0134 | "返回时间轴" | Motion Curve / Graph · src/ui/GraphEditor.tsx:645 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0135 | "曲线属性" | Motion Curve / Graph · src/ui/GraphEditor.tsx:654 (select) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0136 | "曲线分量" | Motion Curve / Graph · src/ui/GraphEditor.tsx:673 (select) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0137 | {m === 'value' ? '值曲线' : '速度曲线'} | Motion Curve / Graph · src/ui/GraphEditor.tsx:697 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0138 | {label} | Motion Curve / Graph · src/ui/GraphEditor.tsx:711 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0139 | "适应曲线视图" | Motion Curve / Graph · src/ui/GraphEditor.tsx:720 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0140 | "重置曲线视图" | Motion Curve / Graph · src/ui/GraphEditor.tsx:723 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0141 | "关键帧时间（秒）" | Motion Curve / Graph · src/ui/GraphEditor.tsx:754 (NumberField) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0142 | "关键帧数值" | Motion Curve / Graph · src/ui/GraphEditor.tsx:767 (NumberField) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0143 | {label} | Motion Curve / Graph · src/ui/GraphEditor.tsx:803 (NumberField) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0144 | {key.toUpperCase()} | Motion Curve / Graph · src/ui/GraphEditor.tsx:825 (NumberField) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0145 | "曲线关键帧区间" | Motion Curve / Graph · src/ui/GraphEditor.tsx:874 (select) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0146 | 适应全部关键帧 | Motion Curve / Graph · src/ui/GraphEditor.tsx:893 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0147 | 适应选中关键帧 | Motion Curve / Graph · src/ui/GraphEditor.tsx:894 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0148 | 空间路径 | Motion Curve / Graph · src/ui/GraphEditor.tsx:899 (summary) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0149 | {view.playing ? '暂停曲线预览' : '播放曲线预览'} | Motion Curve / Graph · src/ui/GraphEditor.tsx:912 (IconButton) | 1 | F2 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0150 | "停止曲线预览" | Motion Curve / Graph · src/ui/GraphEditor.tsx:919 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0151 | "曲线循环播放" | Motion Curve / Graph · src/ui/GraphEditor.tsx:929 (IconButton) | 1 | F2 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0152 | "曲线预览时间" | Motion Curve / Graph · src/ui/GraphEditor.tsx:937 (input) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0153 | "缩小曲线视图" | Motion Curve / Graph · src/ui/GraphEditor.tsx:951 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0154 | "放大曲线视图" | Motion Curve / Graph · src/ui/GraphEditor.tsx:955 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0155 | '保持' | Motion Curve / Graph · src/ui/GraphEditor.tsx:1318 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0156 | '复制' | Motion Curve / Graph · src/ui/GraphEditor.tsx:1331 (Menu / Registry) | 1 | F3 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0157 | '粘贴' | Motion Curve / Graph · src/ui/GraphEditor.tsx:1332 (Menu / Registry) | 1 | F3 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0158 | '删除' | Motion Curve / Graph · src/ui/GraphEditor.tsx:1334 (Menu / Registry) | 1 | F3 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0159 | '编辑 Motion Curve' | Motion Curve / Graph · src/ui/GraphEditor.tsx:1341 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0160 | '重置缓动' | Motion Curve / Graph · src/ui/GraphEditor.tsx:1351 (Menu / Registry) | 1 | F3 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0161 | '复制缓动' | Motion Curve / Graph · src/ui/GraphEditor.tsx:1353 (Menu / Registry) | 1 | F3 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0162 | "位置" | Inspector · src/ui/Inspector.tsx:51 (AnimatedField) | 2 | F2 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0163 | "缩放" | Inspector · src/ui/Inspector.tsx:56 (AnimatedField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0164 | "旋转" | Inspector · src/ui/Inspector.tsx:64 (AnimatedField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0165 | "透明度" | Inspector · src/ui/Inspector.tsx:70 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0166 | "图层名称" | Inspector · src/ui/Inspector.tsx:139 (TextField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0167 | "位置" | Inspector · src/ui/Inspector.tsx:146 (AnimatedField) | 2 | F2 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0168 | "缩放" | Inspector · src/ui/Inspector.tsx:147 (AnimatedField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0169 | "旋转" | Inspector · src/ui/Inspector.tsx:155 (AnimatedField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0170 | "透明度" | Inspector · src/ui/Inspector.tsx:161 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0171 | "锁定图层" | Inspector · src/ui/Inspector.tsx:172 (input) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0172 | "填充颜色" | Inspector · src/ui/Inspector.tsx:184 (input) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0173 | "填充颜色 HEX" | Inspector · src/ui/Inspector.tsx:212 (TextField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0174 | "文字内容" | Inspector · src/ui/Inspector.tsx:238 (TextField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0175 | "字号" | Inspector · src/ui/Inspector.tsx:244 (NumberField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0176 | "字体" | Inspector · src/ui/Inspector.tsx:284 (TextField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0177 | 语义信息 | Inspector · src/ui/Inspector.tsx:315 (summary) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0178 | "语义角色" | Inspector · src/ui/Inspector.tsx:316 (TextField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0179 | "视觉角色" | Inspector · src/ui/Inspector.tsx:321 (TextField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0180 | "重要程度" | Inspector · src/ui/Inspector.tsx:326 (NumberField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0181 | "标签" | Inspector · src/ui/Inspector.tsx:344 (TextField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0182 | {layerMarquee.overlay} {menu && operations && ( <ContextMenu items={items} {...menu} onClose={() => setMenu(undefined)} /> )} {menu && !operations && ( <CreatePieMenu store={store} items={items} {...menu} onClose={() => setMenu(undefined)} /> )} | Scene / Outliner · src/ui/LayerPanel.tsx:73 (Tabs) | 1 | F4 | O | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0183 | "双击打开合成" | Scene / Outliner · src/ui/LayerPanel.tsx:89 (button) | 1 | F4 | O | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0184 | "图层操作" | Scene / Outliner · src/ui/LayerPanel.tsx:117 (IconButton) | 1 | F3 | O | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0185 | {${layer.visible ? '隐藏' : '显示'} ${displayName(layer.name)}} | Scene / Outliner · src/ui/LayerPanel.tsx:183 (IconButton) | 1 | F4 | O | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0186 | {${layer.locked ? '解锁' : '锁定'} ${displayName(layer.name)}} | Scene / Outliner · src/ui/LayerPanel.tsx:198 (IconButton) | 1 | F4 | O | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0187 | "重命名图层" | Scene / Outliner · src/ui/LayerPanel.tsx:215 (input) | 1 | F3 | O | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0188 | {选择 ${displayName(layer.name)}} | Scene / Outliner · src/ui/LayerPanel.tsx:228 (button) | 1 | F2 | O | Selection-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0189 | ${l.name} · ${propertyLabel(e.key)} · ${s.from.time}→${s.to.time} 秒 | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:102 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0190 | "返回时间轴" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:229 (IconButton) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0191 | "适应缓动视图" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:239 (IconButton) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0192 | "缓动应用范围" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:250 (select) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0193 | "缓动目标区间" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:264 (select) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0194 | {name} | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:289 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0195 | {key.toUpperCase()} | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:309 (NumberField) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0196 | {side === 'out' ? '出影响（%）' : '入影响（%）'} | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:327 (NumberField) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0197 | "缓动应用模式" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:356 (select) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0198 | 缓动操作与预设 | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:370 (summary) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0199 | 反转曲线 | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:373 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0200 | "保留出侧，将入侧设为中心对称" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:379 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0201 | "保留入侧，将出侧设为中心对称" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:386 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0202 | 复制缓动 | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:393 (button) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0203 | 粘贴缓动 | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:403 (button) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0204 | {view.playing ? '暂停缓动预览' : '播放缓动预览'} | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:423 (IconButton) | 1 | F2 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0205 | "停止缓动预览" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:430 (IconButton) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0206 | "缓动循环播放" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:440 (IconButton) | 1 | F2 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0207 | "缓动合成预览时间" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:449 (input) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0208 | "缩小缓动视图" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:470 (IconButton) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0209 | "放大缓动视图" | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:477 (IconButton) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0210 | '0,0' | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:526 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0211 | '1,1' | Motion Curve / Graph · src/ui/MotionCurvePanel.tsx:527 (Menu / Registry) | 1 | F4 | K | Keyframe-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0212 | {label} | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:67 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0213 | {应用预设 ${p.name}} | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:78 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0214 | "预设名称" | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:110 (input) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0215 | 保存当前曲线 | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:118 (button) | 1 | F2 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0216 | {state.favorites.includes(chosen) ? '取消收藏' : '收藏预设'} | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:129 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0217 | 复制预设 | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:135 (button) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0218 | 重命名预设 | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:148 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0219 | 删除预设 | Motion Curve / Graph · src/ui/MotionPresetBrowser.tsx:154 (button) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0220 | {playing ? '暂停小球' : '播放小球'} | Motion Curve / Graph · src/ui/MotionPreview.tsx:34 (button) | 1 | F2 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0221 | 关闭路径编辑器 | Inspector · src/ui/PathEditor.tsx:138 (button) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0222 | 适应路径视图 | Inspector · src/ui/PathEditor.tsx:233 (button) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0223 | 转换为平滑点 | Inspector · src/ui/PathEditor.tsx:236 (button) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0224 | 转换为角点 | Inspector · src/ui/PathEditor.tsx:263 (button) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0225 | 添加路径点 | Inspector · src/ui/PathEditor.tsx:277 (button) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0226 | 删除路径点 | Inspector · src/ui/PathEditor.tsx:285 (button) | 1 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0227 | {property.keyframes.length ? '关闭' : '开启'} {title} 动画 | Inspector · src/ui/PathEditor.tsx:299 (button) | 1 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0228 | {${title}选中点 ${label}} | Inspector · src/ui/PathEditor.tsx:306 (NumberField) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0229 | "路径预览时间" | Inspector · src/ui/PathEditor.tsx:341 (input) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0230 | {支点：${pivotLabels[mode]}} | Application / Workspace · src/ui/PivotSelector.tsx:35 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0231 | 布局建议 | Assistant / Settings · src/ui/ProposalPanel.tsx:46 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0232 | 配色建议 | Assistant / Settings · src/ui/ProposalPanel.tsx:47 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0233 | 动效建议 | Assistant / Settings · src/ui/ProposalPanel.tsx:48 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0234 | 应用建议 | Assistant / Settings · src/ui/ProposalPanel.tsx:53 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0235 | 取消 | Assistant / Settings · src/ui/ProposalPanel.tsx:78 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0236 | 空间路径（独立于缓动） | Motion Curve / Graph · src/ui/SpatialMotionEditor.tsx:28 (summary) | 1 | F3 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0237 | {路径${side === 'out' ? '出' : '入'}点 ${axis.toUpperCase()}} | Motion Curve / Graph · src/ui/SpatialMotionEditor.tsx:46 (NumberField) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0238 | 恢复直线路径 | Motion Curve / Graph · src/ui/SpatialMotionEditor.tsx:92 (button) | 1 | F4 | K | Keyframe-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0239 | "父级图层" | Inspector · src/ui/StructureControls.tsx:34 (select) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0240 | "图层入点" | Inspector · src/ui/StructureControls.tsx:59 (NumberField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0241 | "图层出点" | Inspector · src/ui/StructureControls.tsx:85 (NumberField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0242 | 在播放头拆分图层 | Inspector · src/ui/StructureControls.tsx:112 (button) | 2 | F2 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0243 | 选中图层预合成 | Inspector · src/ui/StructureControls.tsx:121 (button) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0244 | 进入预合成 | Inspector · src/ui/StructureControls.tsx:138 (button) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0245 | "启用三维图层" | Inspector · src/ui/ThreeDControls.tsx:24 (input) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0246 | "摄像机位置" | Inspector · src/ui/ThreeDControls.tsx:46 (AnimatedField) | 2 | F2 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0247 | "摄像机旋转" | Inspector · src/ui/ThreeDControls.tsx:51 (AnimatedField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0248 | "摄像机焦距" | Inspector · src/ui/ThreeDControls.tsx:56 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0249 | "摄像机视角（°）" | Inspector · src/ui/ThreeDControls.tsx:63 (NumberField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0250 | "三维位置" | Inspector · src/ui/ThreeDControls.tsx:111 (AnimatedField) | 2 | F2 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0251 | "三维旋转" | Inspector · src/ui/ThreeDControls.tsx:116 (AnimatedField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0252 | "三维缩放" | Inspector · src/ui/ThreeDControls.tsx:121 (AnimatedField) | 2 | F3 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0253 | "三维锚点" | Inspector · src/ui/ThreeDControls.tsx:127 (AnimatedField) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0254 | {展开 ${displayName(layer.name)} 属性} | Timeline · src/ui/Timeline.tsx:694 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0255 | {${layer.visible ? '隐藏' : '显示'} ${displayName(layer.name)} 图层} | Timeline · src/ui/Timeline.tsx:707 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0256 | {${layer.locked ? '解锁' : '锁定'} ${displayName(layer.name)} 图层} | Timeline · src/ui/Timeline.tsx:722 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0257 | "时间轴图层名称" | Timeline · src/ui/Timeline.tsx:739 (input) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0258 | {layer.name} | Timeline · src/ui/Timeline.tsx:765 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0259 | {group.open ? '▾' : '▸'} {group.label} | Timeline · src/ui/Timeline.tsx:816 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0260 | {${property.keyframes.length ? '关闭' : '开启'} ${displayName(layer.name)} ${propertyLabel(key, layer)} 动画} | Timeline · src/ui/Timeline.tsx:876 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0261 | {添加 ${displayName(layer.name)} ${propertyLabel(key, layer)} 关键帧} | Timeline · src/ui/Timeline.tsx:888 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0262 | {删除 ${displayName(layer.name)} ${propertyLabel(key, layer)} 关键帧} | Timeline · src/ui/Timeline.tsx:905 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0263 | {关键帧 ${displayName(layer.name)} ${propertyLabel(key, layer)} ${frame.time.toFixed(3)} 秒} | Timeline · src/ui/Timeline.tsx:947 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0264 | "插值设置" | Timeline · src/ui/Timeline.tsx:1105 (summary) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0265 | {插值 ${displayName(layer.name)} ${propertyLabel(key, layer)}} | Timeline · src/ui/Timeline.tsx:1106 (select) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0266 | "回到起点" | Timeline · src/ui/Timeline.tsx:1211 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0267 | "回到终点" | Timeline · src/ui/Timeline.tsx:1220 (IconButton) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0268 | {view.playing ? '暂停' : '播放'} | Timeline · src/ui/Timeline.tsx:1229 (button) | 1 | F2 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0269 | "当前时间（秒）" | Timeline · src/ui/Timeline.tsx:1237 (input) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0270 | "停止" | Timeline · src/ui/Timeline.tsx:1251 (IconButton) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0271 | "循环播放" | Timeline · src/ui/Timeline.tsx:1260 (IconButton) | 1 | F2 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0272 | "时间轴吸附" | Timeline · src/ui/Timeline.tsx:1267 (IconButton) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0273 | "切换秒 / 时间码" | Timeline · src/ui/Timeline.tsx:1275 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0274 |  | Timeline · src/ui/Timeline.tsx:1285 (Tabs) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0275 | "搜索时间轴属性" | Timeline · src/ui/Timeline.tsx:1615 (input) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0276 | 关键帧 ▾ | Timeline · src/ui/Timeline.tsx:1623 (summary) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0277 | 动画缓动 | Timeline · src/ui/Timeline.tsx:1625 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0278 | "上一个关键帧" | Timeline · src/ui/Timeline.tsx:1633 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0279 | "下一个关键帧" | Timeline · src/ui/Timeline.tsx:1636 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0280 | 复制 | Timeline · src/ui/Timeline.tsx:1639 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0281 | 粘贴 | Timeline · src/ui/Timeline.tsx:1640 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0282 | 复制关键帧到下一帧 | Timeline · src/ui/Timeline.tsx:1641 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0283 | 删除关键帧 | Timeline · src/ui/Timeline.tsx:1647 (button) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0284 | "时间轴属性筛选" | Timeline · src/ui/Timeline.tsx:1657 (select) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0285 | "适合合成时长" | Timeline · src/ui/Timeline.tsx:1683 (button) | 1 | F4 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0286 | "时间轴缩放" | Timeline · src/ui/Timeline.tsx:1695 (input) | 1 | F3 | T | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0287 | '粘贴' | Timeline · src/ui/Timeline.tsx:1713 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0288 | '适合合成时长' | Timeline · src/ui/Timeline.tsx:1715 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0289 | '添加关键帧' | Timeline · src/ui/Timeline.tsx:1730 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0290 | '移除动画' | Timeline · src/ui/Timeline.tsx:1736 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0291 | '粘贴到此属性' | Timeline · src/ui/Timeline.tsx:1745 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0292 | '打开曲线编辑器' | Timeline · src/ui/Timeline.tsx:1747 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0293 | '打开动画缓动' | Timeline · src/ui/Timeline.tsx:1754 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0294 | '在播放头拆分图层' | Timeline · src/ui/Timeline.tsx:1778 (Menu / Registry) | 1 | F2 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0295 | '缓入' | Timeline · src/ui/Timeline.tsx:1811 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0296 | '缓出' | Timeline · src/ui/Timeline.tsx:1816 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0297 | '缓入缓出' | Timeline · src/ui/Timeline.tsx:1820 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0298 | '线性' | Timeline · src/ui/Timeline.tsx:1821 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0299 | '保持' | Timeline · src/ui/Timeline.tsx:1822 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0300 | '打开曲线编辑器' | Timeline · src/ui/Timeline.tsx:1824 (Menu / Registry) | 1 | F4 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0301 | '打开动画缓动' | Timeline · src/ui/Timeline.tsx:1831 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0302 | '复制缓动' | Timeline · src/ui/Timeline.tsx:1838 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0303 | '粘贴缓动' | Timeline · src/ui/Timeline.tsx:1851 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0304 | '复制' | Timeline · src/ui/Timeline.tsx:1867 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0305 | '粘贴' | Timeline · src/ui/Timeline.tsx:1872 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0306 | '删除关键帧' | Timeline · src/ui/Timeline.tsx:1877 (Menu / Registry) | 1 | F3 | T | Mode-dependent | D2 | Good | 保留能力；按功能族统一归属 |
| E-0307 | '新建工程' | Application / Workspace · src/ui/Toolbar.tsx:86 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0308 | '打开工程' | Application / Workspace · src/ui/Toolbar.tsx:94 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0309 | '工程另存为' | Application / Workspace · src/ui/Toolbar.tsx:106 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0310 | '切换侧面板' | Application / Workspace · src/ui/Toolbar.tsx:119 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0311 | '保存工程' | Application / Workspace · src/ui/Toolbar.tsx:127 (Menu / Registry) | 1 | F2 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0312 | '命令搜索' | Application / Workspace · src/ui/Toolbar.tsx:135 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0313 | '撤销' | Application / Workspace · src/ui/Toolbar.tsx:143 (Menu / Registry) | 1 | F2 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0314 | '重做' | Application / Workspace · src/ui/Toolbar.tsx:151 (Menu / Registry) | 1 | F2 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0315 | '重做' | Application / Workspace · src/ui/Toolbar.tsx:159 (Menu / Registry) | 1 | F2 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0316 | '复制' | Application / Workspace · src/ui/Toolbar.tsx:166 (Menu / Registry) | 1 | F3 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0317 | '粘贴' | Application / Workspace · src/ui/Toolbar.tsx:173 (Menu / Registry) | 1 | F3 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0318 | '复制选中' | Application / Workspace · src/ui/Toolbar.tsx:180 (Menu / Registry) | 1 | F3 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0319 | '全选' | Application / Workspace · src/ui/Toolbar.tsx:187 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0320 | 筛选 ${filter} | Application / Workspace · src/ui/Toolbar.tsx:223 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0321 | '删除选中' | Application / Workspace · src/ui/Toolbar.tsx:242 (Menu / Registry) | 1 | F3 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0322 | '重命名' | Application / Workspace · src/ui/Toolbar.tsx:248 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0323 | '适合窗口' | Application / Workspace · src/ui/Toolbar.tsx:261 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0324 | '100% 实际尺寸' | Application / Workspace · src/ui/Toolbar.tsx:262 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0325 | '放大' | Application / Workspace · src/ui/Toolbar.tsx:263 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0326 | '缩小' | Application / Workspace · src/ui/Toolbar.tsx:264 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0327 | '播放 / 平移' | Application / Workspace · src/ui/Toolbar.tsx:274 (Menu / Registry) | 1 | F2 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0328 | '取消操作' | Application / Workspace · src/ui/Toolbar.tsx:284 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0329 | '移动 / 步进' | Application / Workspace · src/ui/Toolbar.tsx:296 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0330 | '设置 · AI 服务' | Application / Workspace · src/ui/Toolbar.tsx:366 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0331 | 创建 ${layerKindLabels[kind]} | Application / Workspace · src/ui/Toolbar.tsx:372 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0332 | '适合画布' | Application / Workspace · src/ui/Toolbar.tsx:378 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0333 | '打开曲线编辑器' | Application / Workspace · src/ui/Toolbar.tsx:383 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0334 | '导出' | Application / Workspace · src/ui/Toolbar.tsx:388 (Menu / Registry) | 1 | F4 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0335 | '保存工程' | Application / Workspace · src/ui/Toolbar.tsx:393 (Menu / Registry) | 1 | F2 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0336 | '添加高斯模糊' | Application / Workspace · src/ui/Toolbar.tsx:398 (Menu / Registry) | 1 | F3 | G | Always | D2 | Acceptable | 保留能力；按功能族统一归属 |
| E-0337 | "工程命令" | Application / Workspace · src/ui/Toolbar.tsx:429 (summary) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0338 | 新建合成 | Application / Workspace · src/ui/Toolbar.tsx:447 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0339 | 打开工程 | Application / Workspace · src/ui/Toolbar.tsx:462 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0340 | 新建工程 | Application / Workspace · src/ui/Toolbar.tsx:471 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0341 | 工程另存为 | Application / Workspace · src/ui/Toolbar.tsx:472 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0342 | 保存工程 ↗ | Application / Workspace · src/ui/Toolbar.tsx:481 (button) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0343 | 合成设置 | Application / Workspace · src/ui/Toolbar.tsx:482 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0344 | 设置 · AI | Application / Workspace · src/ui/Toolbar.tsx:497 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0345 | "搜索命令" | Application / Workspace · src/ui/Toolbar.tsx:511 (IconButton) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0346 | 导出 | Application / Workspace · src/ui/Toolbar.tsx:518 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0347 | "播放预览" | Application / Workspace · src/ui/Toolbar.tsx:525 (IconButton) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0348 | "撤销" | Application / Workspace · src/ui/Toolbar.tsx:532 (IconButton) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0349 | "重做" | Application / Workspace · src/ui/Toolbar.tsx:540 (IconButton) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0350 | 创作助手 | Application / Workspace · src/ui/Toolbar.tsx:555 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0351 | "打开工程文件" | Application / Workspace · src/ui/Toolbar.tsx:563 (input) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0352 | "导入图片文件" | Application / Workspace · src/ui/Toolbar.tsx:584 (input) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0353 | 取消 | Application / Workspace · src/ui/Toolbar.tsx:612 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0354 | 保存当前工程 | Application / Workspace · src/ui/Toolbar.tsx:613 (button) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0355 | 创建空白工程 | Application / Workspace · src/ui/Toolbar.tsx:616 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0356 | "合成名称" | Application / Workspace · src/ui/Toolbar.tsx:680 (input) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0357 | {新合成 ${{ width: '宽度', height: '高度', fps: '帧率', duration: '时长' }[key]}} | Application / Workspace · src/ui/Toolbar.tsx:703 (input) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0358 | "合成背景颜色" | Application / Workspace · src/ui/Toolbar.tsx:726 (input) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0359 | 取消 | Application / Workspace · src/ui/Toolbar.tsx:764 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0360 | {editingComposition ? '应用合成设置' : '创建合成'} | Application / Workspace · src/ui/Toolbar.tsx:767 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0361 | {item.label} | Application / Workspace · src/ui/Toolbar.tsx:783 (IconButton) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0362 | {${labelPrefix}变换轴向} | Inspector · src/ui/TransformControls.tsx:72 (select) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0363 | {${labelPrefix}变换支点} | Inspector · src/ui/TransformControls.tsx:91 (select) | 2 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0364 | "服务名称" | Assistant / Settings · src/ui/ai/AISettings.tsx:115 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0365 | "供应商" | Assistant / Settings · src/ui/ai/AISettings.tsx:124 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0366 | "API Base URL" | Assistant / Settings · src/ui/ai/AISettings.tsx:158 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0367 | "API Key" | Assistant / Settings · src/ui/ai/AISettings.tsx:171 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0368 | "默认模型" | Assistant / Settings · src/ui/ai/AISettings.tsx:182 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0369 | 自定义请求头 | Assistant / Settings · src/ui/ai/AISettings.tsx:199 (summary) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0370 | "自定义请求头" | Assistant / Settings · src/ui/ai/AISettings.tsx:201 (textarea) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0371 | 取消 | Assistant / Settings · src/ui/ai/AISettings.tsx:211 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0372 | {busy ? '正在保存…' : '保存服务'} | Assistant / Settings · src/ui/ai/AISettings.tsx:222 (button) | 1 | F2 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0373 | "关闭 AI 设置" | Assistant / Settings · src/ui/ai/AISettings.tsx:261 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0374 |  | Assistant / Settings · src/ui/ai/AISettings.tsx:265 (Tabs) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0375 | 添加服务 | Assistant / Settings · src/ui/ai/AISettings.tsx:293 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0376 | 编辑 | Assistant / Settings · src/ui/ai/AISettings.tsx:316 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0377 | {p.enabled ? '停用' : '启用'} | Assistant / Settings · src/ui/ai/AISettings.tsx:319 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0378 | 设为默认 | Assistant / Settings · src/ui/ai/AISettings.tsx:332 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0379 | 测试连接 | Assistant / Settings · src/ui/ai/AISettings.tsx:349 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0380 | 删除 | Assistant / Settings · src/ui/ai/AISettings.tsx:355 (button) | 1 | F3 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0381 | 获取模型列表 | Assistant / Settings · src/ui/ai/AISettings.tsx:384 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0382 | {${m.id} ${cap}} | Assistant / Settings · src/ui/ai/AISettings.tsx:401 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0383 | {label} | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:26 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0384 | {task + ' 模型路由'} | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:51 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0385 | "最多重试次数" | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:96 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0386 | "默认 Agent 模式" | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:127 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0387 | "最多自动修正次数" | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:159 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0388 | "默认 Skill" | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:176 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0389 | "每日 token 预算" | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:228 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0390 | "达到预算行为" | Assistant / Settings · src/ui/ai/AdvancedAISettings.tsx:246 (select) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0391 | 创建 Skill | Assistant / Settings · src/ui/ai/SkillSettings.tsx:26 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0392 | 导入 Skill | Assistant / Settings · src/ui/ai/SkillSettings.tsx:42 (button) | 1 | F2 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0393 | "导入 Skill 文件" | Assistant / Settings · src/ui/ai/SkillSettings.tsx:45 (input) | 1 | F2 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0394 | "Skill 名称" | Assistant / Settings · src/ui/ai/SkillSettings.tsx:78 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0395 | "Skill 说明" | Assistant / Settings · src/ui/ai/SkillSettings.tsx:87 (input) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0396 | "Skill 指令" | Assistant / Settings · src/ui/ai/SkillSettings.tsx:98 (textarea) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0397 | "Skill 允许工具" | Assistant / Settings · src/ui/ai/SkillSettings.tsx:110 (textarea) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0398 | 返回 | Assistant / Settings · src/ui/ai/SkillSettings.tsx:132 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0399 | 保存 Skill | Assistant / Settings · src/ui/ai/SkillSettings.tsx:136 (button) | 1 | F2 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0400 | {s.source === 'builtin' ? '查看' : '编辑'} | Assistant / Settings · src/ui/ai/SkillSettings.tsx:150 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0401 | {s.enabled ? '停用' : '启用'} | Assistant / Settings · src/ui/ai/SkillSettings.tsx:153 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0402 | 复制 | Assistant / Settings · src/ui/ai/SkillSettings.tsx:159 (button) | 1 | F3 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0403 | 删除 | Assistant / Settings · src/ui/ai/SkillSettings.tsx:166 (button) | 1 | F3 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0404 | 导出 | Assistant / Settings · src/ui/ai/SkillSettings.tsx:173 (button) | 1 | F4 | G | Mode-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0405 | {title} | Inspector · src/ui/axis-link.tsx:52 (button) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0406 | {label} | Inspector · src/ui/fields.tsx:217 (input) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0407 | "Enter 换行 · Cmd/Ctrl+Enter 提交 · Esc 取消" | Inspector · src/ui/fields.tsx:335 (textarea) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0408 | input (动态实例) | Inspector · src/ui/fields.tsx:341 (input) | 1 | F4 | P | Property-dependent | D1 | Good | 保留能力；按功能族统一归属 |
| E-0409 | '变换' | Application / Workspace · src/ui/timeline-visible-rows.ts:7 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0410 | 效果 ${Number(effect[1]) + 1} | Application / Workspace · src/ui/timeline-visible-rows.ts:12 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0411 | 遮罩 ${Number(mask[1]) + 1} | Application / Workspace · src/ui/timeline-visible-rows.ts:16 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0412 | '合成参数' | Application / Workspace · src/ui/timeline-visible-rows.ts:17 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0413 | '三维 / 摄像机' | Application / Workspace · src/ui/timeline-visible-rows.ts:18 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0414 | '文字' | Application / Workspace · src/ui/timeline-visible-rows.ts:20 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0415 | '外观 / 图形' | Application / Workspace · src/ui/timeline-visible-rows.ts:21 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0416 | { kind === 'image' ? '导入 图片' : 创建 ${layerKindLabels[kind]} } | Application / Workspace · src/ui/workspace/CreatePieMenu.tsx:104 (button) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0417 | "更多图层操作" | Application / Workspace · src/ui/workspace/CreatePieMenu.tsx:142 (button) | 1 | F3 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0418 | "关闭创建菜单" | Application / Workspace · src/ui/workspace/CreatePieMenu.tsx:147 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0419 | "导入图片文件" | Application / Workspace · src/ui/workspace/CreatePieMenu.tsx:151 (input) | 1 | F2 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0420 | {preference.collapsed ? '展开曲线属性' : '折叠曲线属性'} | Application / Workspace · src/ui/workspace/CurveWorkspace.tsx:79 (IconButton) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0421 | '图层颜色' | Scene / Outliner · src/ui/workspace/layer-actions.ts:29 (Menu / Registry) | 3 | F3 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0422 | '复制图层' | Scene / Outliner · src/ui/workspace/layer-actions.ts:35 (Menu / Registry) | 3 | F3 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0423 | '复制' | Scene / Outliner · src/ui/workspace/layer-actions.ts:41 (Menu / Registry) | 3 | F3 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0424 | '粘贴' | Scene / Outliner · src/ui/workspace/layer-actions.ts:46 (Menu / Registry) | 3 | F3 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0425 | '重命名' | Scene / Outliner · src/ui/workspace/layer-actions.ts:47 (Menu / Registry) | 3 | F4 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0426 | '选中图层预合成' | Scene / Outliner · src/ui/workspace/layer-actions.ts:49 (Menu / Registry) | 3 | F3 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0427 | '创建父级空对象' | Scene / Outliner · src/ui/workspace/layer-actions.ts:59 (Menu / Registry) | 3 | F3 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0428 | '删除选中图层' | Scene / Outliner · src/ui/workspace/layer-actions.ts:103 (Menu / Registry) | 3 | F3 | O | Selection-dependent | D3 | Wrong | IA-01/04/05上下文/深度需调整 |
| E-0429 | {${(narrow && key !== 'bottom' ? mobilePanel !== key : collapsed[key]) ? '显示' : '隐藏'}${{ left: '左面板', right: '属性面板', bottom: '时间轴' }[key]}} | Application / Workspace · src/ui/workspace/layout.tsx:225 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0430 | "搜索命令" | Application / Workspace · src/ui/workspace/palette.tsx:53 (input) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0431 |  | Application / Workspace · src/ui/workspace/palette.tsx:65 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0432 | {label} | Application / Workspace · src/ui/workspace/primitives.tsx:15 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0433 | {title} | Application / Workspace · src/ui/workspace/primitives.tsx:39 (summary) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0434 | {item} | Application / Workspace · src/ui/workspace/primitives.tsx:82 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0435 | ‹ 返回图层操作 | Application / Workspace · src/ui/workspace/primitives.tsx:168 (button) | 1 | F3 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0436 |  | Application / Workspace · src/ui/workspace/primitives.tsx:173 (button) | 1 | F4 | G | Always | D1 | Good | 保留能力；按功能族统一归属 |
| E-0437 | '选择工具' | Application / Workspace · src/ui/workspace/tools.tsx:11 (Menu / Registry) | 1 | F2 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0438 | '平移工具' | Application / Workspace · src/ui/workspace/tools.tsx:12 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0439 | '矩形工具' | Application / Workspace · src/ui/workspace/tools.tsx:13 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0440 | '椭圆工具' | Application / Workspace · src/ui/workspace/tools.tsx:14 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0441 | '钢笔工具' | Application / Workspace · src/ui/workspace/tools.tsx:15 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
| E-0442 | '文字工具' | Application / Workspace · src/ui/workspace/tools.tsx:16 (Menu / Registry) | 1 | F4 | G | Always | D2 | Good | 保留能力；按功能族统一归属 |
