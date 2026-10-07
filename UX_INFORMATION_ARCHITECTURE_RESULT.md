# Swayframe 0.9.12 · 全局信息架构与功能入口重构

执行基线：`docs/baseline/INFORMATION_ARCHITECTURE.txt`。原始代码基线：db86a03 / 0.9.11。日期：2026-10-07。完成真实代码迁移、回归与浏览器任务验证；没有新增动画算法或替换 Command System。

## 1. Skills 安装与使用

| Skill | 结果 | 本轮使用 |
|---|---|---|
| ui-ux-design / ChloeVPin | 官方 installer 下载失败，main/master 返回404；API亦遇到限流 | 未安装，未声称使用；证据 `outputs/information-architecture/skill-ui-ux-design.log` |
| ux-heuristics / wondelai | 安装前审查 SKILL.md 与目录；使用官方 installer 安装 | 读取已安装 SKILL.md，执行 Nielsen、发现性、严重度、Trunk Test 与复审 |
| design-system / danieloleary | 安装前审查文件，无不相关安装脚本；使用官方 installer 安装 | 读取已安装 SKILL.md；以根 DESIGN.md 约束本轮改动 |
| professional-creative-editor-ui / 项目现有 | 保留现有 Skill | 保持五区工作台、专业密度、共享控件与真实界面检查 |

没有运行第三方 install script，没有 symlink。缺失的 ui-ux-design 不阻止已授权重构；本轮按用户给出的 IA 模型及另外两个已安装 Skill 执行。

Restart Codex to enable automatic skill discovery in future sessions.

## 2. 原始问题与高严重度发现

`UX_INFORMATION_ARCHITECTURE_AUDIT.md` 包含 87 个界面/桌面文件的 442 条基线代码入口索引，以及动态 Property / Layer / Node / Effect 能力族。索引不是442个独立功能：重复控件、动态表达式和菜单容器分别记录。Frequency/Depth/Discoverability 是专家估计；AST规则用于初筛，能力族和关键工作流另行人工代码复核，不代表逐个入口都做了真人研究。

五项 Severity 3：对象右键先进入创建而非操作；Web应用菜单分类缺失；搜索缺大量已有能力；父级与效果入口默认隐藏；效果到节点流程断开。原审计未发现已确认 Severity 4。

## 3. 功能入口移动记录

| 功能 | 原入口问题 | 新主入口与原因 |
|---|---|---|
| 全局软件操作 | 文件菜单混合、其他分类缺失 | 文件 / 编辑 / 图层 / 动画 / 视图 / 窗口 / 帮助；Web与原生使用一致分类 |
| 创建对象 | 右键隐式入口难发现 | Scene标题“创建对象”与空白饼菜单；有类型图标；图层菜单和搜索服务键盘/长尾工作流 |
| 对象操作 | 右键先创建再进入更多操作 | 对象右键直接结构菜单；Canvas保留空间对齐，Scene不显示对齐分布 |
| Parent / Precompose | 与时间混在折叠区 | Inspector“层级”默认展开；Scene右键、图层菜单可达；Scene显示父级身份 |
| In/Out/Split | 与结构混杂 | Timeline与独立“图层时间”高级区 |
| Effects / Masks | 默认隐藏 | Inspector“效果与遮罩”默认展开；类型参数原样保留 |
| Compositing Graph | 只能记住底部Tab | Effects区“打开合成节点”；窗口菜单、搜索亦可进入；自动展开隐藏dock |
| Keyframe / Ease | footer永久杂项菜单 | 属性行记录/右键、关键帧右键、动画菜单；Graph/Motion为编辑主区域 |
| 素材操作 | 图层创建与资源导入含混 | File导入到素材库；Project选择素材后添加；素材右键复用原添加/重连/删除 |
| 搜索 / 帮助 | 搜索类型不全，无操作指引 | Cmd/Ctrl+K搜索已有操作叶子；Help提供任务路径与真实Registry快捷键 |

## 4. 删除的重复入口与保留的多入口

删除顶部播放，保留底部共享播放；删除 Timeline footer 关键帧永久菜单，其复制/粘贴/删除保留 Edit、快捷键与选区右键，“复制到下一帧”保留关键帧右键。删除对象右键中的创建优先中间层，空白创建仍保留。原生面板切换只归 Window，不再同时占 View。所有对象类型从 File 分离到 Layer/Scene创建。

顶部 Export 保留：它是高频交付操作；File Export服务全局文件路径，搜索服务键盘路径。Inspector预合成与对象右键分别服务属性/结构工作流。缓动面板预设按钮服务持续调整，关键帧右键服务选区快捷操作。没有为每个长尾能力增加常驻按钮。

## 5. 新 IA 与规则

Project→合成和素材；Scene→对象层级；Canvas→空间和绘制；Inspector→对象参数；Timeline→时间与关键帧；Graph/Motion→数值、速度、缓动；Compositing→图像处理；Assistant→AI；Application Menu→软件级命令；Palette→可搜索的已有操作；Context Menu→当前选择。

根 `DESIGN.md` 定义全部12条放置规则、常驻入口预算、各模块职责、渐进披露、快捷键、Undo、选择、现有tokens、可访问性与反模式。根 `AGENTS.md` 要求后续 UI 修改先读 DESIGN.md、判断用户任务/频率/Scope/Context，再查 Matrix，复用入口。设计校验0 errors / 0 warnings；spacing/rounded说明位于正文，工具给出对应信息提示，无新的视觉主题。

`FEATURE_LOCATION_MATRIX.md` 包含能力主归属、合法次入口、快捷键和移除位置，并关联全部基线入口ID。动态参数由实际对象/效果/节点注册表展开，不伪造 Expression、物理模拟等未实现功能。

## 6. 实际代码与架构

- `src/shared/application-menu.ts` 定义 Web/Electron 共用菜单分类与动作ID；`editor-actions.ts` 统一应用菜单、命令搜索、快捷键和原生动作适配。
- `object-actions.ts` 复用对象创建 Transaction；Pie和应用操作调用同一创建路径。
- `layer-actions.ts` 按 Canvas / Scene / Timeline 过滤；属性、关键帧、节点、素材各自上下文菜单不再共用万能操作集合。
- `AnimatedField` 增加动画记录/移除/Graph/Motion上下文入口；Inspector层级与时间分区；Effects直达Nodes；Project显式合成与素材操作。
- `ApplicationMenus` / ContextMenu 统一菜单键盘导航、Esc、焦点返回、互斥展开；窄窗口修复topbar滚动导致popover不可见的问题。
- `Toolbar` 只保留一个全局快捷键监听；局部Graph/Motion使用Registry dispatcher。输入框保留文本快捷键。保存最后工作区上下文，Edit在节点模式不会删除图层；受保护Source/Output不可删除，没有节点跨图剪贴板则明确禁用。
- 原生新/开/存继续使用 ProjectService 和既有 IPC；其他原生动作进入同一 EditorAction。Scene修改仍是 Command/Transaction；UI布局、菜单、模式状态不写Scene。Intelligence仍只生成Proposal。

## 7. 实际用户任务验证

在独立 `http://127.0.0.1:5177/` 工程通过真实点击、输入、菜单操作执行；没有改动用户5176工程或调用付费模型。这是代理操作验收，不是真人可发现性研究。

| Task | 实际路径和观察 | 结果/证据 |
|---|---|---|
| 1 创建矩形 | Scene 创建对象→带图标矩形；命名“入口验收矩形” | 完成；ease-out.jpg含Scene身份 |
| 2 修改Position | Inspector解除位置链接，X=400，Y保持540 | 完成；真实数值/Canvas位置变化 |
| 3 Position动画 | 属性行记录0秒，1秒修改X=1100自动记录；Timeline展开见两个菱形 | 完成；关键帧0/1秒可操作 |
| 4 Ease Out | 0秒关键帧右键→缓出→缓动Tab | 完成；X1=0/Y1=0/X2=.58/Y2=1；ease-out.jpg；面板播放时间推进到1.219秒，停止回0 |
| 5 图片Blur | File导入icon.png到素材库→添加图片层→搜索gaussianBlur→Nodes Inspector半径18 | 完成；图像明显模糊，image-blur.jpg；返回图层Inspector同值18 |
| 6 Parent | Scene对象右键创建父级空对象；父级下拉和Scene↳状态同步 | 完成；parent.jpg；Undo恢复后继续任务 |
| 7 Precompose | Scene右键预合成→Inspector进入→画布面包屑返回合成01 | 完成；precompose.jpg；工程读写往返另有自动测试 |
| 8 Camera/3D | 创建饼菜单Camera；矩形右键开启三维 | 完成；camera.jpg；三维位置X真实出现 |
| 9 Compositing | Effects打开合成节点→Source/Blur/Output；选择Blur参数 | 完成；image-nodes.jpg、image-blur.jpg |
| 10 Export | File→Export→当前帧 | 入口及渲染状态完成（当前帧已导出）；export.jpg。浏览器下载事件超时，未独立取得本轮下载文件，不能据此声称落盘验证完成 |

用户是否自然猜中入口仍需真人任务观察；本轮没有将自动化操作成功率冒充用户研究成功率。

## 8. Trunk Test

| Workspace | 我在哪/编辑什么 | 主要任务/主要操作 | 去哪里/如何返回 |
|---|---|---|---|
| Project | 活动合成与素材列表 | 导入、复用素材、新建合成 | 项目/图层/助手Tabs，双击合成 |
| Scene / Canvas / Inspector | 选中高亮、对象名称、合成名 | 创建/选择/空间操作/属性参数 | 侧区Tabs、Window、Undo |
| Timeline | 活动Tab、图层/属性名、当前时间 | 动画与关键帧 | Graph/Motion/Nodes Tabs |
| Graph | 曲线编辑器Tab、属性/组件上下文 | 值/速度及切线 | 返回时间轴、Tabs |
| Motion | 标准化缓动、对象·属性·0→1秒 | 缓动预设和坐标、面板内播放 | 返回时间轴、Tabs |
| Nodes | 合成节点Tab、图片·图层合成、节点属性标题 | 图像连接及参数 | 图层属性、Timeline Tab |
| Precomp | 预合成标题与上级合成面包屑 | 内部对象编辑 | 返回合成 合成01 |
| Settings | 设置→AI标题、分类Tabs | 服务/模型配置 | 关闭AI设置 |
| Assistant | 助手活动Tab、创作助手与当前工程 | 输入请求/审阅Proposal | 项目/图层Tabs，不侵占全局主要工具 |

以上主要区域均能从可见标题/选择/标签确定定位并返回。本轮验证未发起真实AI请求，也未配置或读取用户密钥。

## 9. 第二轮 Heuristic Audit

Quick Diagnostic 专家估计由3/10提升到8/10；仍按每项中等问题扣1，非用户满意度/统计结论。

| Nielsen项 | Before | After与证据 | 剩余Severity |
|---|---|---|---|
| 系统状态可见 | 模式入口与当前上下文断开 | 活动Tab、对象/节点标题、父级身份、导出状态可见 | 0（覆盖范围内） |
| 匹配真实世界 | 文件承担对象创建，结构/时间混杂 | 七菜单及区域职责；时间轴/Inspector分工 | 0 |
| 用户控制与自由 | 隐藏dock打开不明显、模式返回弱 | 打开同时展开dock、返回Timeline与Precomp面包屑；共享Undo | 0 |
| 一致性与标准 | 多入口业务和菜单分类不统一 | 共用EditorAction/Transaction、原生与Web同分类 | 2，原生禁用状态未实时同步 |
| 错误预防 | 上下文快捷键可能误删层 | 节点Edit选择保护、Source/Output保护、输入框文本编辑 | 0（所测回归） |
| 识别优于回忆 | 右键嵌套、搜索缺项、默认隐藏父级效果 | Scene显式创建、结构直达、搜索叶子、Inspector展开 | 0 |
| 灵活性与效率 | 高频编辑需额外打开深层入口 | 属性/选区右键、Registry、Palette直达 | 0 |
| 简约和密度 | 播放及Timeline杂项重复 | 删除顶部播放、footer关键帧菜单；保留专业五区 | 2，Inspector默认展开内容仍较长 |
| 错误恢复 | 迁移入口可能绕过命令 | 共享history及Undo回归；既有错误提示/AI输入保留不改 | 0（覆盖范围内） |
| 帮助与发现 | Help缺操作路径 | 任务指引、Registry快捷键、中文路径 | 0 |

复审额外发现并修复：650px topbar overflow裁切菜单；节点选择为空时Edit可能回落删除图层；菜单/搜索需订阅graphSelection；原生分类顺序和Web不一致。覆盖范围内没有明显剩余Severity 3/4；未对全产品做无缺陷保证。

## 10. 质量与交付边界

- 全量109个测试文件 / 411 tests通过；本轮14项专门入口回归，包括多属性单Transaction、Ease区间语义、节点编辑安全、菜单键盘/焦点、禁用状态、搜索与原生动作适配。
- lint、typecheck、Web/desktop build通过；保持既有Vite大chunk提示，本轮不改模块加载架构。
- 1280×720、1440×900、1920×1080、2560×1440读取实际DOM尺寸，document未水平溢出。650×760检查导航、侧栏抽屉及菜单裁切并修复。
- 1280/1440可完整视觉检查；大尺寸截图后端部分裁切，不能仅凭截图保证全屏像素质量，DOM布局证据见viewport-metrics.json。
- macOS ARM64与Windows x64安装包构建并逐文件核对app.asar中的dist/desktop-dist与最终本地构建；结果及SHA256见outputs/information-architecture/verification.json。
- 本轮未执行原生运行时完整任务，Windows未实机运行，安装包未签名。原生适配测试和打包一致性不替代平台实机验证。

## 11. 剩余问题与下一步

1. Severity2：原生菜单仍由执行时保护上下文，未实现每次选择变动的enabled同步；Web菜单已按上下文禁用。
2. Severity2：Inspector较长，可按真实调试反馈优化默认折叠，不再增加常驻入口。
3. 收集熟悉AE等软件的真人10任务首次定位/误点记录，优先修重复猜错的位置；本轮仅专家判断和代理操作。
4. 在真实macOS/Windows执行安装与导出文件落盘检查；不把本轮浏览器下载超时升级为已验证。
5. ui-ux-design仓库地址恢复后再用官方installer审查安装；无需为此暂停当前可审查代码。
