# IA-0 全局入口架构审计

基线：0.9.14 / e2598c1。源码扫描覆盖 src/ui、src/desktop、apps/desktop/electron 的控件、菜单标签、二级菜单、弹窗和动态入口族，机器可复核索引见 outputs/ia-refactor/entry-inventory.json。扫描属于代码与启发式审计，不能证明真人发现性。既有 UX_INFORMATION_ARCHITECTURE_AUDIT.md 保留历史，不作为本轮实时清单。

| 范围 | 当前机制 | 问题与严重度 | 迁移目标 |
|---|---|---|---|
| Top / Canvas toolbar | actions、tools 与独立 JSX | 常驻按钮与命令两种绑定，工具缺统一 Feature 元数据（3） | contribution + tool registry |
| Project / Assets / Startup / Settings | 专用面板，原生文件服务 | 参数/动态资源绑定不能被简单静态菜单替代（2） | 登记入口族、保留原生服务 |
| Scene / Canvas / Timeline 图层右键 | layerActions 按文字筛选 | 主入口、可用条件、命令身份依赖标签，复制实现分散（3） | typed context + commandId |
| Inspector | 主组件内写所有 Section | 新对象需要改主组件，空外观区/无关三维区占空间（3） | Section registry + appliesTo |
| Timeline / Keyframe / Property | 右键数组 + 本地插值函数 | Ease 与应用菜单两套执行逻辑，快捷键/搜索覆盖不同（3） | 同一 Command，按 Context contributions |
| Motion / Graph | 分区与共享播放已实现 | 曲线搜索缺 curve/speed 等别名，局部动作缺登记（2） | 元数据搜索、模式上下文 |
| Compositing / Node context | 已有 NodeDefinition、搜索 | 已有架构应扩展，不再建立平行节点表；搜索词少（2） | 丰富 NodeRegistry 元数据与统一入口 |
| Effects / Masks | 已有参数定义，添加入口手写 | 效果缺分类/支持类型/渲染绑定元数据，添加按钮重复业务（3） | EffectRegistry 派生节点及菜单 |
| Application / Electron menus | 共享部分 applicationMenus + native 手写部分 | 图层、插值子菜单另写，增加命令需同时修改多处（3） | DOM-free feature contributions 共享 |
| Palette / Shortcuts | buildEditorActions + dispatchShortcut | 仅搜索 label/keywords、不能按域/对象发现；缺唯一主归属（3） | Registry 搜索、上下文排序和路径 |
| Assistant / Dialog / Popover | 专用有状态工作流 | 不能把发送/取消/字段变成全局无参数按钮（2） | 工作流入口登记，内部状态仍模块所有 |

无确认 Severity 4。Before 启发式 Quick Diagnostic 约 5/10：导航结构已有基础，但功能归属/扩展契约、搜索别名与同命令一致性失败。分数是专家判断，非用户测量。主任务为持续编辑（F1/F2、Selection/Canvas/Timeline），资源与应用管理为 F3/F4，复杂 AI 和特殊曲线为上下文渐进披露。本轮冻结新效果、节点、图层、动画与 3D 能力。

## 入口盘点口径

一个功能拥有一个 canonical home，重复控件是 secondary workflow。实例参数（属性值、图层 id、素材路径、节点端口）不是新的全局 Command。注册表负责入口和能力，既有专用编辑器负责可变实例、手势和表单生命周期；它们仍必须经共享 Command System 提交 Scene。每个扫描入口在 FEATURE_INVENTORY.md 保留源码位置、域/对象/任务/频率/上下文/主归属与 commandId，表达式按动态入口族记录，不虚构具体实例。

## IA-13 复查与修复

迁移复查发现两个实质回归，均已修复：曲线区间右键一度缺失精确区间的缓动入口（Severity 3），补充独立 motion.segmentContext 并保持区间 ID；助手常驻重复入口移除后，折叠左栏必须仍可从窗口菜单打开（Severity 3），回归测试改为真实菜单路径并验证展开和 Scene 不变。另将 Timeline transport 从主组件提取为受预算约束的贡献组件，避免后续继续往 Header 写业务。

After：导航、识别、状态、取消、搜索和命令一致性检查通过；内部启发式约 9/10，无本轮已确认未修的 Severity 3–4。仍有 Severity 2：长参数 Section 在小窗口需滚动、动态实例命令必须先有目标；首次发现性未经真人测试，不宣称完全自解释或用户满意度 9/10。关闭面板后保留窗口菜单返回，灰色搜索结果提供“选择适用对象/对应工作区”提示。

### Quick Diagnostic 明细

| 维度 | Before | After | 剩余最高严重度 |
|---|---|---|---|
| 任务与对象匹配 | 功能归属依实现分散 | 九域与唯一主归属 | 0 |
| 一致性 | 多份菜单/插值操作绑定 | 共享 Command 与贡献元数据 | 0 |
| 识别优于记忆 | 缺路径与别名 | 搜索显示归属，支持任务词 | 0 |
| 发现性 | 局部操作缺统一登记 | 显式创建/属性/右键/搜索 | 2，需真人首次任务核验 |
| 极简与预算 | 缺总预算 | 4 Global / 6 Tools，低频禁常驻 | 0 |
| 状态可见性 | 旧目标可能留旧绑定 | 执行前读取最新目标与禁用状态 | 0 |
| 用户控制 | 分散入口可能漏撤销 | 同 Transaction、取消和 Undo 回归 | 0 |
| 错误防止 | 无目标缺一致约束 | context keys 与 disabled | 0 |
| 工作区恢复 | 助手重复入口被依赖 | Window 菜单可恢复面板 | 0 |
| 密度与渐进披露 | 单体 Inspector | appliesTo Sections、效果分类 | 2，长参数/窄窗口仍需滚动 |

After 的主要失败项归为同一“首次发现与长列表”诊断，故内部评分约 9/10；不是精确量化用户体验。没有为提高分数移除必要参数或假称真人测试完成。
