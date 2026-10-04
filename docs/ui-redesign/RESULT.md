# Swayframe 0.7.0 · Full UI/UX Redesign

本轮完成现有编辑器与桌面启动界面的系统改造、三轮真实界面审查和发行包构建。源码基线0.6.3/db7c0a7，任务基线为 `docs/baseline/FULL_UI_REDESIGN.txt`。Project schema仍为0.5.0，渲染/动画/Command/Transaction/Proposal边界保持。

## 改造结果

全局栏36px、工具栏34px，左侧项目/图层/助手，中央画布，右侧属性，底部时间轴/曲线/节点。项目菜单集中既有命令；面板切换从属性标题区域移到工作区工具栏。统一中性暗色tokens、16px矢量图标、26px控件、28px图层行、紧凑文字与小圆角，强调色用于选中和关键状态。删除死品牌样式及187条被规范主题覆盖的旧声明，保留仍承担几何和响应式职责的base.css。

属性面板采用对齐的标量/向量行，X/Y缩短标签且保留完整可访问名称；只有向量显示链接。实时输入和纵向拖动沿用原瞬态预览/一次提交机制。时间轴时长条弱化，菱形关键帧、播放头与当前选区优先；曲线按屏幕像素补偿文字和圆形手柄。节点统一中性外观、分类细线、端口/连线/警告层级，原34px标题与26px端口行几何保留。

创作助手改为上下文入口和左侧Tab，切换保留草稿/Proposal，仍需显式应用Proposal。共享Tabs、Modal、MenuDropdown统一键盘切换、焦点、取消、外部关闭；Export忙碌时不意外卸载。启动/最近工程、合成设置、导出、路径、恢复/About使用同一主题。未新增原本不存在的设置页面、节点分组或minimap。

## 三轮审查

| 轮次 | 实际发现与处理 | 验证 |
|---|---|---|
| UI-1 · Shell/System | 色系和emoji混用、Inspector重复标签、AI争空间、菜单焦点、面板拖动读取旧尺寸 | 分区改造后真实运行；208 tests和全门禁PASS |
| UI-2 · Visual Polish | 图层旧height覆盖紧凑行高；X/Y标签占宽；曲线圆和文字被非等比SVG拉伸；旧CSS覆盖 | 修正实际高度、紧凑标签、像素补偿、清理覆盖；209 tests和全门禁PASS |
| UI-3 · Professional Software Feel | 空曲线提示被旧选择器隐藏；切换助手会丢草稿；按钮/边框/选中层级需统一 | 空状态恢复、保持挂载、收紧视觉层级；209 tests和全门禁PASS，原生复核 |

作者审查判断：画布主导、稳定面板和紧凑属性/时间/节点操作已形成一致的创作工具语言。此结论是本轮真实截图与操作审查，不代表已经通过重度用户长期可用性认证。

## 完成标准对照

| 要求 | 结果与证据 |
|---|---|
| 1/2/20：统一且接近桌面创作工具 | 单一tokens/theme、无营销hero、平面面板/列表；editor/native截图 |
| 3：Canvas核心 | 中央尺寸扩展，侧栏紧凑；五种窗口截图 |
| 4：Inspector密度 | 标量一行、向量两轴同行、可折叠；native-editor/live-preview |
| 5：Timeline | 统一播放/时间标尺/选区/菱形，紧凑分层轨道；editor-1280 |
| 6：Node Graph | 小圆角、无卡片阴影、分类/ports/wires层级；nodes.png |
| 7：AI融入工作流 | 上下文助手入口、Tab、保留草稿/Proposal；assistant.png与回归 |
| 8：Toolbar | 统一SVG、菜单和工具区职责清楚；全部editor截图 |
| 9：Selection/Hover/Active | 共用状态tokens及键盘焦点；图层/节点/工具/Tab规则 |
| 10/11/12/13：spacing/radius/type/colors | design-tokens.css、editor-theme.css；保留必要几何像素 |
| 14/15：Panels/Resize | 有界尺寸、同批事件正确提交、取消、折叠/恢复偏好；回归与窗口截图 |
| 16：操作路径 | 助手一键进入、scalar直接编辑、Tab键盘导航、菜单上下文操作；不改变业务语义 |
| 17：布局 | 四种目标尺寸及620px窄窗口无明显主布局破损；窄窗口采用折叠与滚动 |
| 18：Build | Web和desktop build，macOS DMG/Windows NSIS全部成功 |
| 19：主要功能 | 76文件/209 tests；原生A/B数据一致、PNG与旧版一致、实时预览/一次撤销 |

## 验证证据

`outputs/quality/UI-1.log`、`UI-2.log`、`UI-3.log`记录每批typecheck/lint/tests/Web build/desktop build。新增5项交互回归覆盖Tab键盘、Modal焦点/取消/归还、分隔线同批提交与高度约束、助手展开不写Scene、切换保留草稿与Proposal；旧命令/动画/关键帧/节点/路径/文件/IPC测试继续通过。

`outputs/ui-redesign/`：editor-1280、window-1280/1440/1920/2560/620、curve、nodes、assets、assistant，以及原生launcher/editor/export/live-preview截图。窗口验收使用 `/ui-review.html` 中真实编辑器iframe，不做整体缩放；完整截图额外包含42px验收工具栏。它不是新产品页面。

macOS arm64最终0.7.0包使用独立profile：打开0.6.3复杂工程→保存native-A→重新打开→另存native-B，三份JSON严格相等。包含2合成/11图层/1素材及遮罩/效果/动画/曲线/节点/父级/预合成/摄像机。原生0.5秒PNG导出SHA-256：`9bfc83ad23e10afe61e5928e1826ef3cadd3b092eed82b4cfe992f06c32f0a0e`，与旧版验收帧字节一致。旋转输入25未失焦已预览，Enter增加一次历史，Undo恢复0。

发行包：`release/Swayframe-0.7.0-arm64.dmg`、`release/Swayframe Setup 0.7.0.exe`。构建日志、包SHA-256和结构化结果见 `outputs/ui-redesign/package-*.log`、`SHA256.txt`、`verification.json`。

## Skill与验证边界

请求的官方 `frontend-skill` 未安装成功：installer目录接口403；随后核查OpenAI官方skills完整Git树与指定路径均无该Skill。没有改装未知第三方Skill或冒称安装成功。按授权继续创建并实际使用仓库 `professional-creative-editor-ui`，校验结果 `Skill is valid!`。这是唯一未完成的指定外部安装项，不阻止已完成的UI工作。

Windows完成x64交叉打包，未实机安装、输入、DPI或导出验证；两平台包仍未签名并沿用默认Electron应用图标。UI尺寸检查不等同跨平台DPI检查。本轮未重新执行长期资源/恢复测试或建立性能提升结论。已有样式几何与复杂属性界面仍可持续迭代，不宣称达到AE全部成熟度；没有以UI重构扩张渲染、业务模型或真实外部AI服务。
