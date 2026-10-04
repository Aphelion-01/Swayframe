# Swayframe Optimization Result

本轮完成 OP-1～OP-6 六批优化，交付 0.6.3。按 `docs/baseline/OPTIMIZATION_POLISH.txt` 先真实使用再修复；没有增加大型功能模块。每批均通过质量门禁并保存 Git 检查点。

## Major UX Improvements

快速角点缩放现在提交最新手势值。原生实测 100%→148.663%，松手保持结果；一次 Undo 回到100%，Redo恢复148.663%。修复前同批 pointermove/pointerup 会增加历史但提交初始值。

播放头更新与静态轨道分离；当前关键帧的高亮和控件仍同步，新增关键帧读取实时播放头。面板不再因为不使用的时间/预览字段变化重建；取消、连续预览、方向键、链接、复制粘贴与曲线操作保留原有交互。

## Performance Improvements

下表为两轮空闲采样的中位耗时范围，单位ms。使用相同开发基准、独立旧/新版本页面、1280×720视口；每项24次RAF节奏交互。BENCH-A/B实际展开全部动画轨道，C显示20节点，D为1080p合成与多个真实Blur/Color效果。

| 场景 | 播放头 before | 播放头 after | 画布拖动 before | 画布拖动 after |
|---|---:|---:|---:|---:|
| A：50层/200关键帧 | 6.9 | 4.0～4.2 | 6.4 | 1.5～1.8 |
| B：100层/1000关键帧 | 14.8～15.2 | 6.5～6.6 | 13.3 | 2.4～4.3 |
| C：20节点 | 4.1～4.5 | 3.5～4.0 | 3.4～3.7 | 3.1～3.4 |
| D：1080p多效果 | 2.7～5.8 | 3.9～5.1 | 5.6～5.8 | 1.6～2.0 |

关键帧选择的Canvas调用从每24次选择24次降到0次。纯节点布局提交/Undo回归中为0次；基准布局阶段总计25→1次，剩余1次来自此前拖动取消的收尾，并非布局编辑本身。

B工程加载/保存的单次JSON/schema CPU仍需毫秒级处理；相同版本的50次Store保存读取只序列化1次。没有把字符串缓存称为磁盘速度提升。

原始记录同时包含React耗时、Canvas耗时、帧间隔、load/save。帧间隔中位仍约16.7ms，受显示调度影响；这是开发Profiler数据，不等同于发行版FPS。D的播放头区间重叠，尚不能证明加速；构建并行期间的数据未纳入最终比较。详见 `outputs/optimization/performance-summary.json` 及其中列出的4份有效原始记录。

## Stability Fixes

修复快速缩放的旧预览提交，保持一次意图一次Transaction。选区从空变为图层后，等值选区也保持稳定帧引用。取消监听器30次重渲染的注册次数从62降到2，最新回调和卸载清理都有回归。

原生完整工程 Save A→Close→Reopen→Save B 严格相等：2合成、11图层、1素材，包含Shape/Text/Mask/Effects/Keyframes/MotionCurve/Graph/Parent/Precomp/Camera/Asset。0秒及0.5秒PNG实际导出通过；0.5秒PNG与旧版对应验收帧字节完全相同，SHA-256均为 `9bfc83ad23e10afe61e5928e1826ef3cadd3b092eed82b4cfe992f06c32f0a0e`。证据见 `outputs/optimization/native-roundtrip.json`。

## Architecture Improvements

冻结场景按时间缓存求值，选区只包装结果；冻结图层局部结果以WeakMap有界缓存。单层位置预览只使对应层局部结果失效，父子世界矩阵仍按依赖正确重算。

节点显示字段与视觉输入分离；只有position/name/metadata被排除，参数、连线、开关、素材、嵌套合成及未知字段仍触发失效。比较只用于提交版本，瞬态pointer预览绕过全工程比较。

`useEditorSlice`按实际显示字段订阅；App状态栏、Toolbar、LayerPanel不随无关时间字段重建。Scene仍只经共享Command/Transaction修改，Intelligence仍只输出Proposal。

## Removed Technical Debt

收敛了每次渲染的取消监听解绑/注册、包含选择的重复场景求值、静态轨道重复构建及相同版本重复序列化。缓存保留上限，图片/离屏/订阅释放原有回归继续通过。

## Desktop Improvements

另存为保留当前路径和文件名；取消不替换工程路径，保存失败仍保持dirty。当前版本的序列化只保留一项，正式保存、dirty检查与恢复读取复用字符串，瞬态预览不进入保存数据。

最终源码重新构建macOS arm64 DMG与Windows x64 NSIS；macOS完整重开/保存/导出实测通过。Windows仅交叉构建，未做实机测试。安装包仍未签名并使用默认图标，记录与SHA见 `outputs/optimization/release-verification.json`。

## Graph Improvements

Graph选择与纯布局操作不再调用画布Renderer。布局依旧持久化并支持Undo；参数、连接和启用状态仍影响画面。既有Graph是Effect Stack唯一数据源；节点缓存的自身/下游失效及故障恢复回归继续通过。

## Tests

| 检查 | 结果 |
|---|---|
| lint | PASS |
| typecheck | PASS |
| tests | 75文件 / 204 tests PASS |
| Web build | PASS |
| desktop build | PASS |
| macOS arm64 package | PASS，原生工作流实测 |
| Windows x64 package | PASS，实机未测试 |

门禁：`outputs/quality/OP-1.log`～`OP-6.log`。新增回归覆盖事件批次缩放、实时播放头新增关键帧、渲染隔离、选区缓存、取消监听、另存为/序列化、父级移动下的局部缓存及选择订阅。原有关键帧拖动、多选、复制粘贴、曲线、遮罩、Graph、恢复、失败保存和资源释放继续运行。

## Remaining P0

本轮已发现的P0缩放错误已修复，当前没有留下已确认P0。

## Remaining P1

- 1000关键帧工程的节点布局提交整体响应仍约17～19ms；Canvas已隔离，需继续拆测Command校验与轨道重建。
- D场景播放头耗时波动，需发行版与长时间播放Profile，当前不能宣称其加速。
- Windows实机输入、DPI、安装、重开、导出及原生大工程磁盘耗时尚未验证。

## Remaining P2

正式图标、发行签名和更长时间使用后的视觉/资源审计仍待完成。旧自动化曾出现数值输入截断，本轮准确输入1250并取消恢复，未复现为产品缺陷。

## Next Optimization Targets

继续优化节点提交时的Command/轨道开销；做发行版持续播放与磁盘保存测试；完成Windows实机验证。保持现有功能范围，不转回大型功能扩张。

代码检查点：`316dd40`、`785fecb`、`482f405`、`fc41058`、`ea94cec`、`163c8b0`。本轮交付的详细状态、已解决问题与剩余优先级保存在 `DEV_SPRINT.md`。
