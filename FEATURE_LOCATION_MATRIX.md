# Feature Location Matrix

每个真实代码入口族都有归属；基线入口ID对应审计文档和JSON，可追溯到源码。动态实例按实际Property/Node/Layer注册表展开，绝不新增不存在的功能。

## Primary capability map

| Feature | Primary Location | Secondary | Shortcut | Remove From |
|---|---|---|---|---|
| 工程新建/打开/保存/另存 | 文件 | 搜索；native File；startup/recent（native） | Cmd/Ctrl+N/O/S/Shift+S | 无 |
| 合成创建/设置 | Project / 文件 | 搜索；窗口打开项目 | — | 混合对象创建菜单 |
| 导入/重复使用/重连/删除素材 | Project Assets | File import、Canvas/Timeline drop、Asset右键 | — | 对象属性区域 |
| 矩形/椭圆/文字/钢笔 | Canvas Tools | Scene创建/空白列表菜单；图层菜单；搜索 | R/E/T/P | File |
| 多边形/星形/纯色/空对象/Camera | Scene创建对象 | 图层菜单；搜索；空白列表菜单 | — | 隐藏操作子菜单 |
| Copy/Paste/Cut/Duplicate/Delete/Undo/Redo | 编辑 / selection context | 搜索；键盘；context | Cmd/Ctrl+C/V/X/D/Z/Shift+Z Delete | Timeline永久菜单 |
| Position/Scale/Rotation/Opacity/Anchor | Inspector Transform | Timeline if animated、Graph | P/S/R/T/U（Timeline筛选） | 无关全局菜单 |
| 外观/路径/文字/三维/Camera参数 | Inspector对象类型Section | PathEditor；animated Timeline/Graph | — | 无关Toolbar |
| Parent/Visibility/Lock/Rename/Reorder | Scene / Inspector父子级 | 对象右键；图层菜单；搜索 | F2 | Timeline header、Canvas toolbar |
| Precompose/Enter/Return | Layer context / Inspector父子级 | 图层菜单；搜索；Canvas双击；合成面包屑 | — | 创建列表菜单的操作深层 |
| LayerSpan/In/Out/Split | Timeline | Inspector图层时间；Timeline对象右键 | — | Scene / global toolbar |
| Animation toggle / Record / Remove | Property row | Property context；动画菜单/搜索记录 | — | global permanent toolbar |
| Keyframe select/move/multi/copy/delete/nextframeclone | Timeline keyframes | 编辑菜单 / keyframe context | Cmd/Ctrl+C/V/D Delete | Timeline footer永久菜单 |
| Interpolation / Ease | Keyframe context | Graph / Motion；动画菜单；搜索 | — | Timeline permanent toolbar |
| Prev/Next key | Timeline | 动画菜单；搜索 | J/K（Timeline） | footer永久入口 |
| Graph / value-speed / handles / velocity / influence | Bottom Graph tab | 动画菜单/搜索；key/property context | Shift+F3；1/2 F/Home Space | unrelated panels |
| Motion normalized presets/library/scope/coords | 曲线编辑器 → 缓动 | Animation/context/search | F Space（mode） | File |
| Spatial path / Bezier points/tangents | Inspector PathEditor / Graph空间路径 | Canvas pen | Enter/P | normalized Motion settings |
| Mask/Blend/Effects参数与顺序 | Inspector效果与遮罩 | Node graph；添加效果搜索 | — | Canvas toolbar |
| Source/Mask/Color/Blur/Merge/Output flow | Compositing Graph | Inspector打开合成节点；窗口菜单/搜索 | Tab/F/Home Space（nodes） | Scene |
| Node connections/selection/layout/enable/rename/duplicate/delete | Compositing Graph context | 节点Inspector；mode keys | Cmd/Ctrl+D Delete | Layer context |
| AI任务/Proposal/refs/history/presets | Assistant | Toolbar/Window/Search | — | Inspector normal editing |
| Provider/model/skill/routing/limits/settings | File设置 → AI | Assistant服务设置；搜索 | — | Canvas/Timeline |
| PNG current/sequence/cancel | File Export | top-right快捷出口；search | — | Canvas tools |
| Playback/time/loop/snap | Bottom preview bar | Space；各curve共用footer | Space/Arrows | Topbar duplicate Play |
| Viewport/reference/pivot/snap | Canvas | View menu/search；Inspector Pivot | Cmd/Ctrl+0/1/=/− | Scene hierarchy |
| Panels/workspace mode/restore | Window | panel tabs/collapse；search | Tab（Canvas） | File settings混区 |
| Help/shortcuts/about | Help | Search；native Help | Cmd/Ctrl+K搜索 | 隐藏独占入口 |

## Complete code entry ownership

所有入口ID逐项归属（包括dialog/popover/隐藏字段/动态实例族）。源代码未迁移的参数继续保留原模块；具体跨区迁移见结果报告。

| Feature ID / Name | Primary Location | Secondary | Shortcut | Remove From |
|---|---|---|---|---|
| E-0001 '退出' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0002 '文件' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0003 '最近工程' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0004 '暂无最近工程' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0005 '关闭窗口' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0006 '退出' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0007 '编辑' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0008 '视图' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0009 '动画' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0010 '窗口' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0011 '帮助' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0012 新建工程 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0013 打开工程… | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0014 {recent.displayName} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0015 {移除最近工程 ${recent.displayName}} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0016 丢弃恢复版本 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0017 恢复工程 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0018 关闭 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0019 "Agent 模式" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0020 "Agent Skill" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0021 管理 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0022 配置 AI 服务 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0023 停止 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0024 对话 · {session.conversation.length} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0025 确认并执行计划 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0026 { canUndo ? '通过共享历史撤销整次操作' : '当前没有可直接撤销的 Agent 操作；后续编辑可使用全局撤销' } | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0027 操作记录 · {session.toolCalls.length} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0028 查看修改前后 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0029 会话历史与动画预设 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0030 新会话 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0031 清除当前工程历史 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0032 {h.summary} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0033 "Agent 动画预设名称" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0034 保存当前图层动画为预设 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0035 用于下次请求 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0036 删除预设 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0037 "添加 Agent 参考" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0038 "参考模式" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0039 {'移除参考 ' + ref.name} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0040 "Agent 需求" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0041 发送 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0042 {label} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0043 {${property.keyframes.length ? '关闭' : '开启'}${label}动画} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0044 {记录${label}关键帧} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0045 {${label}${unit}} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0046 {label} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0047 {${label} HEX} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0048 {${label} 透明度（%）} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0049 {${label} ${['X', 'Y', 'Z', 'A'][i] ?? i + 1}${unit}} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0050 {${label} ${k.toUpperCase()}${unit}} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0051 {key === 'width' ? '图层宽度' : '图层高度'} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0052 "锚点" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0053 "描边颜色" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0054 "描边宽度" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0055 "填充渐变" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0056 "渐变末色" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0057 {key === 'strokeJoin' ? '描边连接' : '描边端点'} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0058 "边数" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0059 "星形内半径" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0060 "路径填充" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0061 编辑贝塞尔路径 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0062 "闭合路径" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0063 "字重" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0064 "字距" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0065 "行距" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0066 "文字对齐" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0067 项目 / 素材 · {view.project.assets.length} | Project / Assets | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0068 导入到素材库 | Project / Assets | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0069 "素材库导入文件" | Project / Assets | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0070 重新链接 | Project / Assets | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0071 {添加素材 ${asset.name}} | Project / Assets | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0072 {删除素材 ${asset.name}} | Project / Assets | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0073 "插入预合成" | Project / Assets | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0074 {返回合成 ${view.project.compositions.find((c) => c.id === id)?.name}} | Canvas | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0075  | Canvas | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0076 "画布吸附" | Canvas | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0077 "画布文字编辑" | Canvas | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0078 完成文字编辑 | Canvas | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0079 "缩放到所选图层" | Canvas | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0080 "画布缩放" | Canvas | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0081 "混合模式" | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0082 遮罩 | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0083 添加 {{ rectangle: '矩形', ellipse: '椭圆', path: '路径' }[kind]} 遮罩 | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0084 {启用遮罩${i + 1}} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0085 {删除遮罩${i + 1}} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0086 {遮罩${i + 1}模式} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0087 编辑遮罩 {i + 1} 路径 | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0088 {遮罩${i + 1}不透明度} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0089 {遮罩${i + 1}羽化} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0090 {遮罩${i + 1}扩展} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0091 效果与调色 | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0092 "添加效果类型" | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0093 添加效果 | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0094 {启用效果${i + 1}} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0095 {删除效果${i + 1}} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0096 {上移效果${i + 1}} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0097 {下移效果${i + 1}} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0098 {效果${i + 1}${spec?.label ?? key}} | Inspector效果与遮罩 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0099 创建合成节点图 | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0100 '添加节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0101 '适应节点图' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0102 '删除节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0103 '复制节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0104 '平移节点图' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0105 ＋ 添加节点 | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0106 适应视图 | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0107 "节点名称" | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0108 {${node.enabled ? '禁用' : '启用'}节点 ${node.name}} | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0109 {${node.name} ${side === 'input' ? '输入' : '输出'} ${port.name}} | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0110 '在连线上插入节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0111 '断开连线' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0112 '重命名节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0113 '复制节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0114 '删除节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0115 '添加节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0116 '适应所有节点' | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0117 "搜索节点类型" | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0118  | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0119 图层属性 | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0120 "节点名称" | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0121 "启用当前节点" | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0122 {spec?.label ?? key} | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0123 删除当前节点 | Compositing Graph / Effects | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0124 "导出开始时间" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0125 "导出结束时间" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0126 导出当前帧 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0127 导出 PNG 序列 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0128 取消导出 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0129 关闭导出 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0130 "返回时间轴" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0131 '曲线平移' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0132 '适应曲线视图' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0133 '曲线视图移动' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0134 "返回时间轴" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0135 "曲线属性" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0136 "曲线分量" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0137 {m === 'value' ? '值曲线' : '速度曲线'} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0138 {label} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0139 "适应曲线视图" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0140 "重置曲线视图" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0141 "关键帧时间（秒）" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0142 "关键帧数值" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0143 {label} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0144 {key.toUpperCase()} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0145 "曲线关键帧区间" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0146 适应全部关键帧 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0147 适应选中关键帧 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0148 空间路径 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0149 {view.playing ? '暂停曲线预览' : '播放曲线预览'} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0150 "停止曲线预览" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0151 "曲线循环播放" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0152 "曲线预览时间" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0153 "缩小曲线视图" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0154 "放大曲线视图" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0155 '保持' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0156 '复制' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0157 '粘贴' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0158 '删除' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0159 '编辑 Motion Curve' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0160 '重置缓动' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0161 '复制缓动' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0162 "位置" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0163 "缩放" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0164 "旋转" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0165 "透明度" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0166 "图层名称" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0167 "位置" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0168 "缩放" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0169 "旋转" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0170 "透明度" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0171 "锁定图层" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0172 "填充颜色" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0173 "填充颜色 HEX" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0174 "文字内容" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0175 "字号" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0176 "字体" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0177 语义信息 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0178 "语义角色" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0179 "视觉角色" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0180 "重要程度" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0181 "标签" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0182 {layerMarquee.overlay} {menu && operations && ( <ContextMenu items={items} {...menu} onClose={() => setMenu(undefined)} /> )} {menu && !operations && ( <CreatePieMenu store={store} items={items} {...menu} onClose={() => setMenu(undefined)} /> )} | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0183 "双击打开合成" | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0184 "图层操作" | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0185 {${layer.visible ? '隐藏' : '显示'} ${displayName(layer.name)}} | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0186 {${layer.locked ? '解锁' : '锁定'} ${displayName(layer.name)}} | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0187 "重命名图层" | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0188 {选择 ${displayName(layer.name)}} | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0189 ${l.name} · ${propertyLabel(e.key)} · ${s.from.time}→${s.to.time} 秒 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0190 "返回时间轴" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0191 "适应缓动视图" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0192 "缓动应用范围" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0193 "缓动目标区间" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0194 {name} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0195 {key.toUpperCase()} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0196 {side === 'out' ? '出影响（%）' : '入影响（%）'} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0197 "缓动应用模式" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0198 缓动操作与预设 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0199 反转曲线 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0200 "保留出侧，将入侧设为中心对称" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0201 "保留入侧，将出侧设为中心对称" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0202 复制缓动 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0203 粘贴缓动 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0204 {view.playing ? '暂停缓动预览' : '播放缓动预览'} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0205 "停止缓动预览" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0206 "缓动循环播放" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0207 "缓动合成预览时间" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0208 "缩小缓动视图" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0209 "放大缓动视图" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0210 '0,0' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0211 '1,1' | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0212 {label} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0213 {应用预设 ${p.name}} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0214 "预设名称" | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0215 保存当前曲线 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0216 {state.favorites.includes(chosen) ? '取消收藏' : '收藏预设'} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0217 复制预设 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0218 重命名预设 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0219 删除预设 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0220 {playing ? '暂停小球' : '播放小球'} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0221 关闭路径编辑器 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0222 适应路径视图 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0223 转换为平滑点 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0224 转换为角点 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0225 添加路径点 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0226 删除路径点 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0227 {property.keyframes.length ? '关闭' : '开启'} {title} 动画 | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0228 {${title}选中点 ${label}} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0229 "路径预览时间" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0230 {支点：${pivotLabels[mode]}} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0231 布局建议 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0232 配色建议 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0233 动效建议 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0234 应用建议 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0235 取消 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0236 空间路径（独立于缓动） | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0237 {路径${side === 'out' ? '出' : '入'}点 ${axis.toUpperCase()}} | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0238 恢复直线路径 | Motion Curve / Graph | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0239 "父级图层" | Scene / Inspector父子级 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0240 "图层入点" | Timeline / Inspector图层时间 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0241 "图层出点" | Timeline / Inspector图层时间 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0242 在播放头拆分图层 | Timeline / Inspector图层时间 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0243 选中图层预合成 | Scene / Inspector父子级 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0244 进入预合成 | Scene / Inspector父子级 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0245 "启用三维图层" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0246 "摄像机位置" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0247 "摄像机旋转" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0248 "摄像机焦距" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0249 "摄像机视角（°）" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0250 "三维位置" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0251 "三维旋转" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0252 "三维缩放" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0253 "三维锚点" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0254 {展开 ${displayName(layer.name)} 属性} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0255 {${layer.visible ? '隐藏' : '显示'} ${displayName(layer.name)} 图层} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0256 {${layer.locked ? '解锁' : '锁定'} ${displayName(layer.name)} 图层} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0257 "时间轴图层名称" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0258 {layer.name} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0259 {group.open ? '▾' : '▸'} {group.label} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0260 {${property.keyframes.length ? '关闭' : '开启'} ${displayName(layer.name)} ${propertyLabel(key, layer)} 动画} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0261 {添加 ${displayName(layer.name)} ${propertyLabel(key, layer)} 关键帧} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0262 {删除 ${displayName(layer.name)} ${propertyLabel(key, layer)} 关键帧} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0263 {关键帧 ${displayName(layer.name)} ${propertyLabel(key, layer)} ${frame.time.toFixed(3)} 秒} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0264 "插值设置" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0265 {插值 ${displayName(layer.name)} ${propertyLabel(key, layer)}} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0266 "回到起点" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0267 "回到终点" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0268 {view.playing ? '暂停' : '播放'} | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0269 "当前时间（秒）" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0270 "停止" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0271 "循环播放" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0272 "时间轴吸附" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0273 "切换秒 / 时间码" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0274  | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0275 "搜索时间轴属性" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0276 关键帧 ▾ | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0277 动画缓动 | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0278 "上一个关键帧" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0279 "下一个关键帧" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0280 复制 | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0281 粘贴 | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0282 复制关键帧到下一帧 | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0283 删除关键帧 | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0284 "时间轴属性筛选" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0285 "适合合成时长" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0286 "时间轴缩放" | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0287 '粘贴' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0288 '适合合成时长' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0289 '添加关键帧' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0290 '移除动画' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0291 '粘贴到此属性' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0292 '打开曲线编辑器' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0293 '打开动画缓动' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0294 '在播放头拆分图层' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0295 '缓入' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0296 '缓出' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0297 '缓入缓出' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0298 '线性' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0299 '保持' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0300 '打开曲线编辑器' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0301 '打开动画缓动' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0302 '复制缓动' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0303 '粘贴缓动' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0304 '复制' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0305 '粘贴' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0306 '删除关键帧' | Timeline | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0307 '新建工程' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0308 '打开工程' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0309 '工程另存为' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0310 '切换侧面板' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0311 '保存工程' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0312 '命令搜索' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0313 '撤销' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0314 '重做' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0315 '重做' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0316 '复制' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0317 '粘贴' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0318 '复制选中' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0319 '全选' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0320 筛选 ${filter} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0321 '删除选中' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0322 '重命名' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0323 '适合窗口' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0324 '100% 实际尺寸' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0325 '放大' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0326 '缩小' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0327 '播放 / 平移' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0328 '取消操作' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0329 '移动 / 步进' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0330 '设置 · AI 服务' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0331 创建 ${layerKindLabels[kind]} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0332 '适合画布' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0333 '打开曲线编辑器' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0334 '导出' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0335 '保存工程' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0336 '添加高斯模糊' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0337 "工程命令" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0338 新建合成 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0339 打开工程 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0340 新建工程 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0341 工程另存为 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0342 保存工程 ↗ | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0343 合成设置 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0344 设置 · AI | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0345 "搜索命令" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0346 导出 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0347 "播放预览" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0348 "撤销" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0349 "重做" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0350 创作助手 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0351 "打开工程文件" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0352 "导入图片文件" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0353 取消 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0354 保存当前工程 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0355 创建空白工程 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0356 "合成名称" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0357 {新合成 ${{ width: '宽度', height: '高度', fps: '帧率', duration: '时长' }[key]}} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0358 "合成背景颜色" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0359 取消 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0360 {editingComposition ? '应用合成设置' : '创建合成'} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0361 {item.label} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0362 {${labelPrefix}变换轴向} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0363 {${labelPrefix}变换支点} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0364 "服务名称" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0365 "供应商" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0366 "API Base URL" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0367 "API Key" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0368 "默认模型" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0369 自定义请求头 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0370 "自定义请求头" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0371 取消 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0372 {busy ? '正在保存…' : '保存服务'} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0373 "关闭 AI 设置" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0374  | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0375 添加服务 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0376 编辑 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0377 {p.enabled ? '停用' : '启用'} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0378 设为默认 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0379 测试连接 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0380 删除 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0381 获取模型列表 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0382 {${m.id} ${cap}} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0383 {label} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0384 {task + ' 模型路由'} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0385 "最多重试次数" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0386 "默认 Agent 模式" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0387 "最多自动修正次数" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0388 "默认 Skill" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0389 "每日 token 预算" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0390 "达到预算行为" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0391 创建 Skill | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0392 导入 Skill | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0393 "导入 Skill 文件" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0394 "Skill 名称" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0395 "Skill 说明" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0396 "Skill 指令" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0397 "Skill 允许工具" | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0398 返回 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0399 保存 Skill | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0400 {s.source === 'builtin' ? '查看' : '编辑'} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0401 {s.enabled ? '停用' : '启用'} | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0402 复制 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0403 删除 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0404 导出 | Assistant / Settings | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0405 {title} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0406 {label} | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0407 "Enter 换行 · Cmd/Ctrl+Enter 提交 · Esc 取消" | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0408 input (动态实例) | Inspector | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | — |
| E-0409 '变换' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0410 效果 ${Number(effect[1]) + 1} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0411 遮罩 ${Number(mask[1]) + 1} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0412 '合成参数' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0413 '三维 / 摄像机' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0414 '文字' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0415 '外观 / 图形' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0416 { kind === 'image' ? '导入 图片' : 创建 ${layerKindLabels[kind]} } | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0417 "更多图层操作" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0418 "关闭创建菜单" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0419 "导入图片文件" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0420 {preference.collapsed ? '展开曲线属性' : '折叠曲线属性'} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0421 '图层颜色' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0422 '复制图层' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0423 '复制' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0424 '粘贴' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0425 '重命名' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0426 '选中图层预合成' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0427 '创建父级空对象' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0428 '删除选中图层' | Scene / 对象右键 | 同族 Context / Inspector / Animated Timeline（适用时） | 见族表/Registry | 创建菜单操作深层/错误混区 |
| E-0429 {${(narrow && key !== 'bottom' ? mobilePanel !== key : collapsed[key]) ? '显示' : '隐藏'}${{ left: '左面板', right: '属性面板', bottom: '时间轴' }[key]}} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0430 "搜索命令" | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0431  | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0432 {label} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0433 {title} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0434 {item} | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0435 ‹ 返回图层操作 | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0436  | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0437 '选择工具' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0438 '平移工具' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0439 '矩形工具' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0440 '椭圆工具' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0441 '钢笔工具' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |
| E-0442 '文字工具' | Application / Workspace | Application Menu / Palette（已注册操作） | 见族表/Registry | — |

## 0.9.13 capability placement

| 能力 | 主入口 | 频率/上下文与任务 | 辅助入口/状态 |
|---|---|---|---|
| 全模式刻度/播放头/播放 | Bottom 各编辑模式顶部 | 高频、合成级：调整时间并观察运动 | Timeline保留轨道对齐的缩放标尺；Graph/Nodes常驻合成标尺，唯一时钟 |
| 缓动 | 曲线编辑器内“缓动” | 中频、关键帧区间：调整时间映射 | 动画菜单/区间右键；删除独立顶级Tab及重复底部播放滑杆 |
| 图层创建 | Scene创建按钮/Scene全区域与Timeline空白右键 | 中频、场景级：创建指定类型对象 | 带类型图标的列表及新建子菜单；删除饼菜单；文件导入复用原流程 |
| 设置父子级 | 图层菜单“设置父子级”/Inspector父子级 | 中频、选中图层：直接选择父级 | Scene对象右键；native命令展开属性面板并聚焦父级 |
| 快速3D | Scene每个图层的3D开关 | 高频、对象级：2D/3D切换，符合行内开关规则 | 图层菜单/Inspector；一次Transaction；3D位置默认不联动 |
| XYZ移动 | 主预览及空间视图选中3D层的轴手柄 | 高频、空间级：按父空间坐标调整XYZ | 键盘微调/Alt精细；实时预览，松手单次提交，Esc/取消恢复 |
| 3D空间 | Canvas标题行“3D空间” | 中频、合成级：与成片并排观察空间位置，现有Canvas无此入口可复用 | MMB绕转/Shift MMB平移/滚轮缩放/F聚焦/1、3、7方向/5投影；独立观察摄像机 |
| 网格/标尺/参考线 | Canvas标题行“辅助”折叠菜单 | 中频、视口级：按合成像素布局 | 网格1/2/5自适应，标尺拖出参考线、双击/拖出删除；UI偏好不入Scene或导出 |

## 0.9.14 capability placement

| 能力 | 主入口 | 频率/上下文 | 状态与约束 |
|---|---|---|---|
| XYZ旋转环 | 3D选区的Canvas“XYZ移动 / XYZ旋转”选择器 | 高频、对象级：直接调整旋转，复用现有视口工具组 | 两视图同步；实际锚点/Euler轴；Shift15°吸附、Alt精细；一次Transaction、取消清理 |
| 触控板空间导航 | 现有3D空间视口 | 高频、视口级：双指绕转、Shift双指平移、捏合缩放 | Chromium ctrl+wheel捏合；连续pixel deltas绕转；离散鼠标轮继续缩放；全部UI状态不入工程 |
