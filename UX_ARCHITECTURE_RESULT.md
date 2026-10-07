# Swayframe 0.9.15 全局入口架构验收

基线为 0.9.14 / e2598c1。本轮只重构现有能力的归属、发现与执行入口，没有增加效果、节点、图层、动画、AI 或 3D 算法。先读取 DESIGN.md、位置矩阵及专业编辑器、design-system、ux-heuristics 指南；任务定位为高频上下文创作与中低频应用管理，保留既有视觉主题。

## 实际变化

生产代码接入 Command Registry、Feature Registry、Context Keys、Contribution System、Inspector Section / Tool / Effect / Graph Node Registry。112 项功能元数据有固定 Domain、对象、任务、频率、上下文和唯一 canonical home。菜单、右键、搜索、绘图工具和 Timeline transport 读取注册机制；属性分区根据对象类型出现。扫描记录 433 个控件/菜单源码入口，动态参数按实例族登记，不冒充 433 项独立无参数命令。

顶栏保留 4 个快捷动作；绘图工具保留 6 个。移除重复助手常驻按钮，左侧标签及窗口菜单可进入。创建类型保留图标和一层列表；Scene/Canvas/Timeline 的结构操作复用命令。Effects 添加器支持类别和关键词；节点搜索读取定义；命令搜索支持 blur / parent / nest / speed / curve 等别名，并显示主归属路径。无对象的操作禁用并提示选择目标。

GUI/Agent 仍经共享 Command System / Transaction；Intelligence 仍只输出 Proposal。视口、入口和面板状态不进入 Scene。曲线精确区间与中间关键帧入/出侧保持原语义；旧菜单条目执行时重新解析当前目标与可用状态。修复单个关键帧粘贴缓动未命中相邻区间的问题。

## 阶段门禁

每阶段均执行 typecheck、lint、全部 unit/integration tests、Web build、desktop build；遇到失败先修复再进入下一阶段。下表链接为各阶段最终通过记录，不能理解为第一次运行均通过。

| 阶段 | 内容 | 验证 |
|---|---|---|
| IA-0 | 全局扫描与审计 | [PASS](outputs/quality/IA-0.log) |
| IA-1 | Domain / DESIGN | [PASS](outputs/quality/IA-1.log) |
| IA-2 | Command Registry | [PASS](outputs/quality/IA-2.log) |
| IA-3 | Feature Registry | [PASS](outputs/quality/IA-3.log) |
| IA-4 | Context Keys | [PASS](outputs/quality/IA-4.log) |
| IA-5 | Contribution Points | [PASS](outputs/quality/IA-5.log) |
| IA-6 | Toolbar / Tools | [PASS](outputs/quality/IA-6.log) |
| IA-7 | Inspector Sections | [PASS](outputs/quality/IA-7.log) |
| IA-8 | Timeline | [PASS](outputs/quality/IA-8.log) |
| IA-9 | Menus / Context | [PASS](outputs/quality/IA-9.log) |
| IA-10 | Command Palette | [PASS](outputs/quality/IA-10.log) |
| IA-11 | Effect / Tool / Node | [PASS](outputs/quality/IA-11.log) |
| IA-12 | 全局迁移与局部工作流 | [PASS](outputs/quality/IA-12.log) |
| IA-13 | 启发式复查修复 | [PASS](outputs/quality/IA-13.log) |
| IA-14 | 扩展性与最终回归 | [PASS](outputs/quality/IA-14.log) |

最终全量 113 个测试文件、435 个测试通过。新增测试覆盖缺失元数据/未知点/重复 ID/分类/预算/无目标/旧目标/共享执行/Undo/单帧缓动粘贴。构建仍有既有大 bundle 提示，不影响成功；没有以提高警告阈值掩盖它。

## 任务路径核查

这是一轮开发者界面操作与自动化回归，不是招募真人进行无教程测试。下面区分亲自操作与代码测试，不能把“入口合理”升级为真实用户一定能找到。

| 用户任务 | 主入口 / 合理线索 | 本轮证据 |
|---|---|---|
| Create Shape | 图层 → 创建对象；Canvas 类型工具 | 实际创建椭圆，Undo 命令测试 |
| Import Image | 项目导入；创建对象 → 导入图片 | 可见创建列表、image-assets 与 desktop-assets 回归 |
| Change Color | 属性 → 外观 → 填充颜色 | 实际修改 HEX，预览更新 |
| Animate Position | 属性 → 变换 → 位置秒表/关键帧 | 实际开启动画、改变时间与位置 |
| Add Ease Out | 关键帧右键 → 缓出；曲线插值 | 实际选择 K1 后缓出；区间/中间帧测试 |
| Open Motion Curve | 曲线编辑器 → 缓动；区间右键 → 编辑缓动 | GraphEditor/Motion UI 回归；界面显示值/速度/缓动 |
| Add Blur | 属性 → 效果与遮罩 → 搜索/类别 | 实际搜索 blur 并添加高斯模糊 |
| Add Mask | 属性 → 效果与遮罩 → 遮罩 | 实际添加矩形遮罩 |
| Parent Layer | 属性 → 父子级；图层关系右键 | 实际设置父级，现有结构测试 |
| Precompose | 图层右键；属性 → 父子级 → 预合成 | 实际通过搜索执行预合成；父子关系不完整时明确拒绝，解除后成功 |
| Enable 3D | Scene 行 3D 开关 | 实际切换并出现 XYZ 与三维属性 |
| Create Camera | 图层 → 创建对象 → 摄像机 | 实际通过搜索创建摄像机，创建命令和 3D 回归 |
| Open Compositing Graph | 属性 → 打开合成节点；底部合成节点 | 实际打开，现有效果节点正常呈现 |
| Export | 文件 → 导出；顶栏导出 | 实际打开导出并显示当前帧已导出；desktop-export / workflow-export 回归 |
| Save Project | 文件 → 保存；Cmd/Ctrl+S | 实际文件菜单保存并显示工程文件已保存；往返与快捷键回归 |
| Relink Asset | 项目素材行 → 重新链接；素材右键 | desktop-assets 测试链接保持 ID 且一次 Undo；未替用户挑选真实外部路径 |

## 扩展性验收

隔离 Registry 模拟 100 Effects、50 Graph Nodes、20 Motion、20 AI Actions、15 Spatial，共 205 项；全部可搜索，AI action 受目标上下文过滤，执行复用 Command Registry。常驻入口预算保持不变；把低频功能塞入永久工具栏、或超过总预算会报错。模拟效果具有参数/支持类型/渲染回调，模拟节点具有 evaluate；均未注册到生产单例。

未来新增入口只需领域模块、命令绑定、Feature 注册及必要 Section/Effect/Node 注册，不需要修改 AppShell、MainToolbar、TimelineHeader 和多个右键菜单。新增算法仍须实现相应 renderer、模型验证或控制器；本次不宣称一个 metadata 对象就能凭空实现 Motion Trail / Optical Flow。内置 ToolId 仍是受支持工具集合，增加真正工具还必须实现 Canvas controller。

## 复查与边界

启发式 Before 约 5/10，After 约 9/10；是内部判断，无本轮已确认未修的 Severity 3–4。剩余 Severity 2：窄窗口的长属性需要滚动，局部命令需先指定目标；达到 10/10 还需要首次使用者任务测试与进一步长列表体验验证。完整明细见 UX_ARCHITECTURE_AUDIT.md。

900、1280、1440、1920、2560 宽度截图与 DOM 尺寸记录在 outputs/ia-refactor；未观察到 document 横向溢出，窄窗口按既有策略折叠面板。截图只证明这些状态，不代表所有弹窗和无限参数组合。原生重链接文件选择、本机触控板手感、Windows 安装启动未在本轮实机复验；自动化与构建通过不能替代这些检查。

## 可复核文件

DESIGN.md、UI_TERMINOLOGY.md、FEATURE_INVENTORY.md、FEATURE_LOCATION_MATRIX.md、UX_ARCHITECTURE_AUDIT.md 与本记录；docs/ARCHITECTURE.md 记录扩展协议，AGENTS.md 固化新增入口检查。`node scripts/feature-inventory.mjs` 可重新生成静态入口清单与位置矩阵；质量日志、扩展测试、尺寸截图和安装包校验值保留在 outputs/ia-refactor。

安装包：release/Swayframe-0.9.15-arm64.dmg、release/Swayframe Setup 0.9.15.exe。macOS/Windows app.asar 中版本均为 0.9.15，确认包含本轮界面；SHA-256 见 outputs/ia-refactor/artifacts.json。打包沿用现有未签名配置，未自动安装或替换正在运行的旧版。截图接口在 1920/2560 设置下返回 1912/2512 像素宽的图像，DOM 尺寸核查独立记录，不把裁剪截图误认为全部画面。

DESIGN.md 官方 lint 最终为 0 errors / 0 warnings / 3 infos。两条 info 指向 frontmatter 未独立定义 spacing/rounded；正文已保留现有间距、控件和圆角规范，未为了消除提示改变主题。第一次受限网络调用失败，最终成功日志为 outputs/ia-refactor/design-lint-final.log。
