# Timeline / Keyframe Editing · 0.9.9

执行基线：`docs/baseline/V02_TIMELINE_INTERACTION.txt`。审计基线：0.9.8 / 6dded46。只修改时间轴及直接相关的共享属性记录、选区、预合成导航；工程 schema 保持 0.6.0。

## Implemented

- Layer → Property Group → Animated Property 三层树，默认折叠。变换（含 Anchor）、外观、文字、已有效果、蒙版和三维/摄像机参数按真实属性分组，不产生空功能。
- 左侧树列冻结，轨道与树共用滚动和可见行模型；列宽 220–480px，可拖动或方向键调整，工作区持久化。行高 28px，名称省略并提供完整 tooltip。
- 图层多选、可见性、锁定、类型/身份色；Pointer Events 排序与插入提示，保留多选内部顺序，一次 Transaction。双击/F2 重命名，预合成双击进入与 Canvas 面包屑同步。
- 搜索、已有动画、所选属性、P/S/R/T/U 快速筛选。快捷筛选只在 Timeline 焦点内；输入框保留自己的快捷键。精确数值仍由 Inspector 负责，Timeline 不重复堆放输入框。
- 动态主/次刻度、秒/时间码切换、统一 round(time × fps) 帧转换；编辑落到整帧，播放继续使用真实 elapsed time。
- 播放头 Pointer 捕获、窗口最终释放坐标、取消恢复；首尾、停止、循环播放。移动播放头不记录历史、不写 Scene。
- 三种关键帧形态：线性菱形、缓动圆菱形、保持方形；单选、Shift/Ctrl/Cmd 增减选区、Shift 框选累加、空白清帧选区但保留图层。
- 多帧拖动冻结原工程、refs、时间和吸附目标；统一 delta、整体边界夹取、屏幕 8px 吸附。默认整帧网格，Cmd/Ctrl 临时关闭外部目标吸附。Alt 拖动显示副本预览，松手后选中新帧。
- 关键帧复制/粘贴保留相对时间和插值，首帧对齐当前时间；显式 Property 目标支持 Number→Number、Vec2→Vec2 和同维 Color。类型不兼容、锁定目标或越界整笔拒绝。
- 右键缓入/缓出/缓入缓出/线性/保持、复制/粘贴缓动、Graph/Motion Curve、复制/删除；动作进入菜单，不永久占满工具栏。J/K 跳前/后关键帧，优先所选属性，否则可见轨道。
- Graph、Motion Curve、Timeline 在轨道区互斥；实际 Property/Segment 是唯一动画数据源。选中两端帧的缓动只作用该段，返回 Timeline 即显示变化。
- Layer Span 移动、两端 Trim、播放头拆分复用已有命令。Trim 不改关键帧时间；Move 延续原有时间偏移语义。
- 鼠标/播放头锚定缩放、1–32 倍、Fit、Shift Wheel、中键/Space 拖动平移；冻结树列和行对齐保持。高度调整、折叠继续复用 Workspace。

## Fixed

冻结关键帧拖动 refs，防止中途选区变化移动错误数据；Shift 移除帧不误启动拖动。框选帧同步所属 Layer，保留已有图层选区。修复非整帧目标吸附、硬编码列宽导致的缩放偏移、Graph 返回后滚轮监听失效、多选中 Graph 错用首个图层、图层上下文误用旧帧选区，以及 Pointer 捕获后双击失效。

Inspector 和 Timeline 现在调用同一个 `recordKeyframeCommand`：统一帧时间、求值、已有帧更新和新帧创建，避免播放中非整帧位置重复添加。选择/过滤/预览保持应用层状态，GUI/Agent 仍共用 Command System。

删除最后一帧后的静态值规则明确保持现有 baseValue；“关闭动画”则保留当前求值并移除动画。两者都可撤销，不暗中改变静态值。

## Performance improvements

关键帧与静态 row JSX 缓存；拖动改用根 CSS delta，避免每次 move 重建所有轨道。播放头当前帧由按时间建立的索引查询，避免每次扫描全部帧。Layer Span 仅在活动手势期间挂载窗口移动监听。

100 图层、500/1000 关键帧均测试了 120 次 scrub 和 200 次 pointermove；预览零 Scene 写入，关键帧 DOM 身份保持，释放一笔历史。React Profiler 开发模式/jsdom 的最终数值见 `outputs/timeline-ux/performance.json`，包含完整门禁并发产生的负载波动；不能当作浏览器绘制成本、桌面 FPS 或播放帧率。当前证据支持保留简单缓存结构，不提前引入虚拟化。

## Test results

最终 lint、typecheck、106 个测试文件 / **379 项测试**、生产 Web 和 desktop build 均通过。Vite 仍有已有的大 chunk 提示，构建成功。

| 验收 | 实际覆盖 |
| --- | --- |
| A | 0/1/2秒框选，整体+1秒，一步Undo/Redo；自动测试和真实界面操作 |
| B | Rectangle/Text/Image 的 Position/Scale/Opacity 动画、Animated Only 与恢复全部属性；集成测试 |
| C | 5秒Fit、鼠标锚定缩放、刻度密度、Graph返回后缩放；布局测试与真实Fit/冻结树列 |
| D | 快速0→5秒scrub、统一求值、零Scene/History写入、DOM稳定；集成/压力测试，真实1.5秒Inspector和Canvas预览 |
| E | 两帧粘贴至3秒保持相对间隔，一次撤销；核心/集成测试，另验证类型和锁定拒绝 |
| F | EaseOut改变实际求值，只作用选中段，撤销恢复；集成测试与真实上下文操作 |
| G | 两端帧进入Graph、修改曲线、返回显示同一插值；集成测试与真实界面操作 |
| H | 0→5秒范围裁为1→4秒，关键帧不变，两步撤销；集成测试 |
| I | 200次move仅一次提交，预览无工程变化；多帧和100层压力测试，真实框选移动验证 |
| J | saveProject/loadProject往返保留顺序/帧/插值/in-out且无UI状态；真实页面本地恢复保留顺序与动画，见ui-recovery.json |

新增测试还覆盖多选排序、整帧时间码、边界精度、Alt复制、Shift去选、空白去选、快捷键输入保护、属性归属、前后帧跳转、列宽、重命名与预合成面包屑。

1280×720、1440×900、1920×1080、2560×1440 均完成截图和 DOM 几何检查。四个尺寸都无文档横向溢出，28px轨道、树标签与轨道中心误差为0；记录见 `viewport.json`。真实流程检查了创建的验收工程打开、过滤、框选、拖动、缓动、Graph往返、排序、缩放、列宽与重命名取消。

## Known issues

- 同一属性不能存在同一时间的两个关键帧；拖动/Alt复制到冲突时间时整笔拒绝并提示，不隐式覆盖。粘贴按已有规则更新目标同时间帧。
- 历史导入的非整帧关键帧保留原始相对偏移，不强制量化或改写旧工程。新建/录制与普通编辑使用整帧时间。
- 1000帧的测试不证明超大工程始终流畅；尚未测端到端浏览器/桌面真实FPS。初次展开大量轨道仍有挂载成本。
- 本轮内置浏览器的保存按钮显示“工程文件已保存”，但自动化下载事件超时，未取得浏览器下载文件作磁盘核对；J的文件内容往返由工程IO集成测试验证，真实页面仅验证本地恢复。不把该项表述为原生磁盘GUI完整验收。
- Windows安装包已生成并核对归档内容；本机没有Windows运行环境，未做Windows实际运行验收。macOS包延续未签名配置。

## Deferred

Marker、Audio Waveform、Time Remap、Roving Keyframe、AI Timeline Agent、大型NLE/高级Dope Sheet、虚拟化和新增Effects/高级3D均不实施。没有新建Graph动画数据，也没有扩张Canvas功能。

## 下一轮 Inspector / Property Editing 建议

1. 多选不同图层的同类属性显示混合值；明确一次输入、数值拖动和链接轴的批量编辑语义。
2. 将所有记录关键帧入口接入共享记录命令，检查效果/颜色等边界输入与当前帧状态是否一致。
3. 锁定层的所有输入、秒表、上下文操作统一禁用反馈，减少点击后才报错。
4. 数字拖动的Escape/失焦/窗口外释放统一取消/提交语义，所有字段保持一次Undo。
5. 表达式、单位和超界值只在明确支持后暴露；为无效输入提供就地说明。
6. 收敛变换参考系/九宫格占用空间，保证小窗口下最常用数值在首屏可见。
7. Inspector显示选中动画属性和当前Segment的来源，避免Timeline/Graph切换后目标不清楚。
8. 统一颜色、向量、文本的实时预览与精确提交，并补跨字段撤销和保存往返测试。
