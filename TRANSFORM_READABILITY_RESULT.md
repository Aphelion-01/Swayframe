# Swayframe 0.8.0 · 轴向、支点与图层可读性验收

按用户提供的 `docs/baseline/TRANSFORM_READABILITY.txt` 执行 TP-0→TP-8→VR-0→VR-8。各阶段完整质量门禁通过，最终 **227 tests / 81 files**，包含 lint、typecheck、Web build、desktop build。未新增 AI、Effect、Graph Node、Motion Blur 或三维功能。

## 已实现

Canvas 顶部提供独立的轴向（全局、局部、父级、视图）和支点（锚点、几何中心、边界中心、选区中心、各自中心、自定义）入口。控制柄与轴线反映实际坐标基，当前支点可见。Canvas、键盘移动、Inspector Scale/Rotate 共用不可变 TransformContext；预览不写 Scene，提交多层及全部 Position/Scale/Rotation 补偿只产生一笔 Transaction。图层 Anchor 保持原属性，自定义支点只修改工作区设置，支持拖动、键盘微调及 Esc 取消。

Timeline 按真实可见 Layer/Group/Property 行计算交替底色，折叠与筛选后重排；左右 sticky 名称与轨道底色相同。图层标题略加强，属性保持26px密度。只有实际选中属性/关键帧的轨道强调，选中图层不把所有展开属性染成整块蓝色。Selection > Hover > Zebra；动画由秒表、当前菱形提示。旧240px滚动高度限制已移除，拉高时间轴后利用全部空间。

图层新增可选 `ui.accentColorId` 身份元数据，新层循环分配六种低饱和色标。Layer Panel/Timeline 共用3px标记；图层菜单可选「无」或六色，支持多选和Undo。色标不改变对象填充、选择轮廓或效果像素，不使Canvas/嵌套Precomp像素缓存失效。

工程格式升级 **0.6.0**，严格校验色标，兼容0.1～0.5迁移。轴向、支点和临时坐标保存在工作区 `swayframe.transform-settings.v1`，不写工程；切换工程沿用习惯。

## 验收对应

| 条目 | 结果与证据 |
| --- | --- |
| A1 | 真实界面创建矩形，左上锚点(-120,-120)，Anchor缩放200%后位置(800,450)不变。 |
| A2 | Undo后以几何中心缩放200%，Position补偿至(680,330)，中心(920,570)保持。 |
| A3 | 两对象共同缩放200%，中心间距750→1500。 |
| A4 | 各自中心缩放/旋转后中心(350,350)、(1100,350)保持。 |
| A5 | 45°对象Global X移动10，位置(700,350)→(710,350)。 |
| A6 | Local X移动10，位置→(707.0711,357.0711)。 |
| A7 | 父级30°轴线真实界面与父级矩阵测试对应；嵌套父级和无父级fallback覆盖。 |
| A8 | 自定义支点(600,350)，对象由(700,350)/45°旋转至(600,450)/135°；Anchor不变。拖动与Esc取消由组件测试验证。 |
| A9 | 连续手柄事件、多选属性编辑只产生一次历史；Undo恢复。组件交互测试与真实属性编辑均验证。 |
| A10 | 工程不含工作区设置；偏好容错读取、切换工程、保存重开及退出恢复覆盖。 |
| B1 | 25个真实图层，标题与色标区分身份，不改变场景填充。 |
| B2 | 四类属性行交替，真实浏览器核对左右背景一致。 |
| B3 | 实际折叠/展开与筛选后可见序号连续，隐藏行不参与。 |
| B4 | 两面板色标一致；修改颜色同时更新。 |
| B5 | 原生修改为accent-6，另存A→退出→最终包重开→另存B，A/B工程JSON一致。None及六色另有严格IO测试。 |
| B6 | 选中底色rgb(51,73,93)，仍保留图层身份小条与选中边线。 |
| B7 | 实际hover底色rgb(52,56,63)，与选中区分；左侧同步。 |
| B8 | 条纹正常底色rgb(34,36,40)/rgb(38,41,46)，色标集中在tokens，不按Property类型染色。 |
| B9 | 25层全部展开为100属性行；播放头0.123→0.234时静态轨道HTML保持，组件测试确认DOM节点复用，无新增逐帧整表重建。 |
| B10 | 行背景/状态/六色色标全部由统一CSS tokens提供，修改tokens不需改Timeline行序逻辑。 |

## 五个实际场景及证据

1. 左上锚点矩形：`anchor-200.png`、`center-200.png`、`gui-created-center-200.png`，实际创建及数值记录见 `browser-acceptance.json`。
2. 多选共同/各自中心：`selection-200.png`、`selection-rotate.png`，记录包含中心坐标与一步Undo。
3. 45° Global/Local：`local-axis.png`，实际键盘轴向移动和真实Canvas指针组件测试；`parent-axis.png`补充父级。
4. 密集Timeline：`dense-timeline-1920.png`、`dense-timeline-hover-real.png`，100行、左右一致、可见行重排与状态颜色记录。
5. 原生保存/退出/重开：`native-A.swayframe`、`native-B.swayframe`、`native-reopened.jpg`、`native-acceptance.json`。

证据目录：`outputs/transform-readability/`；各阶段日志：`outputs/quality/TP-*.log`、`VR-*.log`。开发验收入口 `transform-review.html` 不进入生产编辑器入口。1280×720实际窗口完成编辑；1920×1080为开发布局容器，用于排版截图，不作为实际桌面屏幕尺寸。所有测试使用独立页面/原生profile，未写用户原工程。原生自定义支点指针自动化未可靠完成拖动，未计为通过证据；拖动与取消由组件测试，真实自定义旋转由键盘设置坐标完成。

## 回归与交付边界

旧版完整工程（Text/Path/Image/Precomp/3D/Mask/Effect）在最终桌面包中加载，0.500秒导出PNG与0.7.0验收PNG逐字节一致，见 `render-regression.json`。这证明该样本的像素输出保持，不代表所有工程的渲染均已穷尽测试。

本轮操作实现为二维。View采用屏幕轴并预留Camera/Vec3基；三维选择保留既有操作，禁用新二维控件。工程现有TRS不能表示的非等比世界缩放/某些父级旋转会产生剪切，此时明确拒绝并提示切换局部轴或等比缩放。Bounds为几何、文字glyph、图片/Precomp外部frame，不包含模糊/发光外扩或图片透明像素裁切；旋转手柄为单次±180°交互，无连续多圈累计。

macOS arm64 `.app` / `.dmg`已制作并原生运行验证。Windows x64 NSIS包已构建，未在Windows实机运行。安装包延续当前未签名状态。100行验证针对当前机器与样本的DOM稳定性，不作跨机器帧率承诺。
