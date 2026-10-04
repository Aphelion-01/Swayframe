# Current Goal

按 `docs/baseline/FULL_UI_REDESIGN.txt` 完成全项目UI/UX重构和三轮审查；不扩张动画/渲染/数据模块。

# In Progress

本轮UI-1～UI-3完成，0.7.0代码与两平台安装包一致；76文件/209 tests全门禁PASS。结果见 docs/ui-redesign/RESULT.md，历史Optimization记录保留。

# Completed

CG-0～CG-12 全部实现与桌面验收，0.6.0 两平台安装包构建成功；图片/曝光/Merge/动画保存重开/旧效果迁移实测通过。

V2-1：拖动捕获播放头时间并拒绝过期提交；窗口失焦取消连续预览。

V2-2：Canvas 边缘/中心吸附、临时参考线、Shift 锁方向与 Alt 关闭；100次移动一条历史，取消不修改工程。

V2-3：关键帧整体边界限制、播放头/关键帧/边界吸附、参考线和捕获取消；图层入出点至少一帧，播放头取消恢复起点。

V2-4：二维图层八方向缩放；默认遵循 X/Y 链接，解除后单轴缩放，Shift保持比例，Alt围绕锚点；手柄按屏幕像素保持可见，旋转Shift按15°吸附。修复父级下负缩放符号丢失导致预览漂移。

V2-5：双击文字自动聚焦/全选、多行 Enter 换行、Cmd/Ctrl+Enter 提交、Escape丢弃；中文输入法选字期间不触发提交和快捷键。保存重开保留换行，Undo一次恢复。

V2-6：值/速度曲线滚轮鼠标中心缩放、Space/中键平移、F适应视图；切线拖动正确反算缩放坐标并冻结手势轴范围。视口不写工程，100次切线预览一条事务，输入与曲线快捷键分离。

V2-7：父级索引、按三维依赖闭包计算矩阵、复用摄像机视图；500层/50000关键帧 CPU求值基准约8～13倍加速，校验值一致。

V2-8：0.6.1产品版本、完整创作工程和严格round-trip；打包持续跟随最后修复更新。

V2-9：默认不透明 Source→Output 直接绘制，避免离屏表面和缓存抖动；半透明/混合/遮罩/效果保留原组语义。

V2-10：最终原生工程重开、文字 Undo/Redo、完整数据一致性、PNG 与三帧序列像素验收通过。安装包重新构建，证据见 `outputs/sprint-v2/QA.md`。

# Next High-Value Tasks

1. 节点布局提交的Command校验与Timeline工程变更重建开销，继续细分Profile。
2. BENCH-D发行版持续播放与原生磁盘load/save测量。
3. Windows实机安装、输入、DPI、重开和导出。
4. 长时间资源/恢复测试与已有文字边界细节优化。

# Known Regressions

当前76文件/209 tests通过；0.7.0原生A/B及0.6.3源工程JSON严格相等，0.5秒PNG与旧版验收字节相同。UI改造不宣称额外性能提升。

# Blockers

无开发阻塞。Windows 实机、发行签名和正式 Logo 资源缺少；不阻止本机开发。

# Test Status

Baseline：62 文件 / 165 tests。V2-1：166 tests；V2-2：64 文件 / 170 tests。typecheck、lint、tests、Web build、desktop build PASS，见 `outputs/quality/sprint-v2-interactions.log` 与 `V2-2.log`。

V2-3：66 文件 / 175 tests，全门禁 PASS，见 `outputs/quality/V2-3.log`。Git checkpoint：56a07f2。

V2-4：67 文件 / 178 tests，全门禁 PASS，见 `outputs/quality/V2-4.log`。

V2-5：68 文件 / 180 tests，全门禁 PASS，见 `outputs/quality/V2-5.log`。

V2-6：69 文件 / 182 tests，全门禁 PASS，见 `outputs/quality/V2-6.log`。

V2-7：184 tests；V2-8：184 tests；V2-9：71文件/186 tests，全部门禁PASS。CPU基准见 `outputs/performance/README.md`。

V2-10：71 文件 / 186 tests，typecheck、lint、tests、Web build、desktop build 全部 PASS；原生完整工程保存重开与 PNG 像素验收 PASS。

V2-11：按用户反馈改为数值本身纵向拖动、输入/方向键实时预览，只有实际 XY 向量显示链接图标。字号/尺寸/时间/摄像机/曲线/空间路径数值也接入瞬态预览。72 文件 / 192 tests，全门禁 PASS；网页实测旋转输入无需失焦、纵向拖动一次撤销。见 outputs/NUMERIC_EDIT_UPDATE.md。

## Optimization Backlog

- [P0] OP-01 已修复：快速缩放松手读取旧预览。失败→通过回归；原生100%→148.663%，一次Undo/Redo对称。
- [P1] OP-02 已修复：关键帧/节点选择、状态与时间轴缩放的无效Canvas调用；静态轨道及不变Layer复用；大工程面板只订阅实际字段。
- [P1] OP-05 已修复：Graph布局持久化触发画布求值/渲染；纯布局/Undo零调用，参数/连线仍失效。
- [P1] 待优化：1000关键帧工程节点布局提交的整体UI响应仍约17～19ms。Renderer已隔离，需继续拆测Command校验和轨道重建，不能只优化Canvas。
- [P1] 待复核：BENCH-D播放头响应before 2.7～5.8ms、after 3.9～5.1ms，区间重叠；尚无稳定加速结论。发行版、长时间播放和原生磁盘IO需另测。
- [P1] 外部验证缺口：Windows实机安装/DPI/输入/导出，当前只完成x64交叉打包。
- [P2] OP-03 已修复：另存为默认“未命名”；现保留当前路径/文件名，取消不改变工程路径。
- [P2] 已有发行限制：默认Electron图标、未签名，正式品牌资源/发行签名仍待准备。

### QA观察（非已确认产品缺陷）

OP-04：旧原生输入自动化一次出现1250→50，本轮准确预览1250并Escape恢复，未复现。保留观察，不把工具输入时序误判为产品缺陷。

真实使用记录：新建工程/合成、矩形/文字、移动/缩放/旋转、两位置关键帧、Ease Out、Value/Speed Graph、椭圆遮罩/曝光、父级、父子联合预合成、Blur 节点参数、图片导入、A 保存关闭重开、B 另存与 PNG 导出。A/B JSON 严格相等。父子未同时选中时拒绝预合成符合现有保护规则。

OP-2：196 tests，全门禁 PASS；新增实时播放头新增关键帧、渲染调用隔离及选择复用场景数据回归。

OP-3：节点布局/名称不再触发Scene求值或Canvas Renderer，参数/连线仍失效。198 tests全门禁PASS。

OP-3复核：30次重渲染导致取消监听器注册62次，稳定订阅修复后仅2次，最新回调与卸载清理保持正确。真实基准暴露先空选区后选中导致等值选区快照引用不稳定，补缓存回归。200 tests全门禁PASS。
OP-4：另存为默认已打开工程的路径和文件名；相同冻结版本缓存一次工程序列化，dirty、恢复和保存重复读取复用字符串。仅保留当前版本一项，避免历史JSON缓存累积。
202 tests / 全门禁PASS。OP-03另存为默认名已修复；取消/失败不替换当前路径。序列化50次相同版本只执行一次，提交/Undo正确失效，瞬态预览不会写入工程。

OP-5：移动预览只使受影响图层的局部求值失效，其他图层复用局部矩阵；父级移动仍传播世界变换。203 tests全门禁PASS。0.6.3原生角点拖动100%→148.663%，Undo→100%，Redo→148.663%，只增加一条历史；另存为默认scale-063.swayframe正确。位置输入1250本轮准确预览，Escape恢复，未复现输入截断，OP-04保留为未确认工具时序观察。

OP-6：真实Profile进一步定位App/Toolbar/LayerPanel跟随播放头更新的无效订阅；按实际使用字段切分订阅，避免Scene/选择不变时重建这些面板。
OP-6：204 tests全门禁PASS。隔离基准首轮BENCH-B：播放头15.2ms→6.5ms、画布拖动13.3ms→2.4ms。BENCH-D拖动5.6ms→2.0ms；其播放头CPU响应仍高于旧版（2.7ms→5.1ms），帧间隔16.7ms未变，保留性能待复核，不能宣称所有场景加速。

最终原生验收：full-A保存→关闭→最终包重开→full-B另存，2合成/11图层/1素材严格相等；含Shape/Text/Mask/Effects/Keyframes/MotionCurve/Graph/Parent/Precomp/Camera/Asset。0秒和0.5秒PNG真实导出成功；0.5秒PNG SHA-256与旧版验收帧完全相同。记录：outputs/optimization/native-roundtrip.json。

代码检查点：316dd40、785fecb、482f405、fc41058、ea94cec、163c8b0。当前本轮完成，继续优化目标见OPTIMIZATION_RESULT.md。


## Full UI/UX Redesign / UI-1～UI-3

UI-1：统一tokens/icons/shell/panel/property/node/curve视觉和共享Tabs/Modal/Menu；窗口尺寸有界，分隔线使用同步最新布局提交。208 tests，全门禁PASS。

UI-2 / Visual Polish：属性向量压缩X/Y标签、标量消除重复标签，图层实际行高28px；曲线SVG按屏幕像素补偿文字与圆形手柄，保持原时间/值坐标；移除187条被新主题覆盖的旧样式声明。209 tests，全门禁PASS。

UI-3 / Professional Software Feel：修复曲线空状态提示被旧规则隐藏；助手内容保持挂载，切换标签不丢草稿/Proposal，入口展开折叠面板；启动/导出/设置/路径/恢复/About统一克制视觉与焦点关闭行为。209 tests，全门禁PASS。

真实窗口1280×720/1440×900/1920×1080/2560×1440/620×720截图；原生0.7.0打开复杂工程→保存A→重开→另存B，JSON严格相等；0.5秒PNG SHA-256与旧版相同。原生旋转输入25即时预览，Enter一次历史，Undo恢复0。证据outputs/ui-redesign/verification.json。未验证Windows实机和长期使用；官方frontend-skill当前官方仓库不存在，项目Skill已创建、实际使用并通过校验。
