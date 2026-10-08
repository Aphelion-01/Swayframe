# Swayframe 0.9.17：编辑体验专项验收

本轮对应用户的 12 项反馈。所有工程修改继续经过 Command System；拖动过程使用临时预览，结束后一次提交，取消不写入 Scene。布局、辅助线和预览缓存不进入 Scene。

| 项目 | 本轮结果与验证 |
| --- | --- |
| 摄像机实体、实时光学参数 | 三维空间新增相机机身、镜头和朝向线框（23 条边），拍摄范围仍由选中摄像机时的开关控制。摄像机参数拖动在松手前触发绘制；测试检查临时预览不写 Scene，松手只产生一次撤销记录。 |
| 离焦硬边 | 将投影后的完整图层绘入透明扩展表面，再整体模糊，避免逐三角形裁剪造成矩形边界；扩展边距随模糊半径与输出缩放调整。浏览器检查了离焦轮廓。 |
| XYZ 稳定性与命中 | 移除轴投影接近重合时突然切换的替代方向；保留连续缩短的真实投影，移动轴命中宽度 28 px、旋转环 26 px。小角度投影连续性有回归测试。 |
| 属性适用性 | 摄像机、空对象、模型及 3D 图层隐藏不适用的二维或外观属性；混合选择不显示无效公共变换。基础变换后优先显示 3D、文字及文字动画。 |
| 旋转、作图辅助 | 右侧 3D 属性明确提供移动/旋转手柄切换，与画布入口同步。画布显示“网格 / 参考线 / 标尺”入口；提供按合成像素计量的主格、细分、像素标尺、拖出参考线、中心线、安全框与三分构图。网格自动控制屏幕密度，不输出到成片。 |
| 文字编辑与动画 | 默认“请输入文本”。右侧文字 Section 支持内容、字体、字号、颜色、字重、斜体、下划线、字距、行距、对齐；独立文字动画 Section 支持范围起止/偏移及逐字透明度、位置、缩放、旋转。选择工具双击或文字工具单击聚焦右侧内容编辑，删除画布底部编辑栏。 |
| 合成预设 | 12 种常见横屏、竖屏、方形及 DCI 尺寸；10 种帧率（含 23.976、29.97、59.94）。保留自定义尺寸和帧率。 |
| 媒体导出 | MP4/MOV H.264、设备支持时 H.265、WebM VP9，以及 PNG 当前帧/序列。可设置分辨率、帧率、留边/裁切/拉伸、开始结束、码率、CBR/VBR、关键帧间隔及背景；PNG 可透明。真实导出 MP4/MOV/WebM 各 640×360、30 fps、0.5 s、15 帧，并解析容器验证。 |
| 三工作区统一时间轴 | 时间轴、曲线编辑器、合成节点复用同一 38 px 标尺和播放头。曲线编辑器复用原 28 px 图层/属性行。合成节点内容区不改动。 |
| 真实预览缓存条 | 三工作区标尺下方复用真实渲染条，显示已绘制时间段、耗时和缓存；16 帧/64 MiB 有界缓存。工程视觉变化、资源完成加载时失效，不伪造未渲染状态。 |
| 贝塞尔编辑 | 形状路径可在二维/三维预览中选点及拖动切线；重合切线提供偏移命中控件，键盘支持 1、10、0.1 单位微调。路径/蒙版编辑器支持切线选择与坐标编辑，曲线编辑器扩大手柄命中范围。拖动提交/取消有回归测试。 |
| 图形 UI 说明 | 新手柄、切线、参考线、三维工具等不明显控件添加名称、悬停说明或 SVG title；常见播放按钮保留简洁外观。 |

## 质量与界面检查

- `lint`、`typecheck`、`tests`、`build` 均通过；121 个测试文件，466 项测试。
- 构建仍有主包大于 500 kB 的提醒；视频编码模块按需加载，未把此提醒误报为错误。
- 浏览器检查 1280×720、1440×900、1920×1080、2560×1440 四种视口：无页面横向溢出，共用标尺均为 38 px，缓存条起点与标尺零点对齐。
- 2560 视口全页截图工具有裁切，使用 DOM 尺寸及底部局部截图核验，未据裁切图声称完整视觉覆盖。
- Feature Placement Review：文字/文字动画归右侧 Inspector，三维操控归既有 3D Section，辅助归 View/画布既有菜单，导出归文件导出对话框；未增加全局常驻按钮。
- 新能力注册于 typed contribution 与 CommandRegistry；更新 FEATURE_INVENTORY.md、FEATURE_LOCATION_MATRIX.md，注册测试通过。
- UX 检查覆盖入口可发现性、当前模式反馈、取消/撤销、属性适用性、命中范围与三个时间工作区一致性。

## 已知边界

景深采用薄透镜弥散圈加图层级高斯模糊近似，并非物理光线追踪或真实光圈散景；透明表面处理解决本次硬边问题，不代表复杂遮挡下的完整物理景深。实时反馈按显示分辨率绘制，松手后输出完整质量；复杂工程性能仍取决于设备。

视频是 SDR 8-bit、无音轨（当前工程无音频系统），H.265 取决于设备编码能力；尚未验证每台设备、每个编码器和 8K 实际导出。PNG 每次最多 3000 帧，视频最多 18,000 帧和 512 MB；这些限制在界面明确显示。文字动画是第一代范围选择器，未实现 AE 全部文本动画器。网格用于视觉辅助，未增加网格吸附。

macOS 与 Windows 安装包均已生成，为未签名版本。macOS 原生界面验收被系统锁屏阻止，启动日志无报错，但未将其视为原生交互通过；本轮交互验收使用内置浏览器。Windows 在本机只验证打包，未运行 Windows 原生界面。

## 参考依据

- [Adobe：视图、网格、参考线和安全区域](https://helpx.adobe.com/after-effects/desktop/view-and-preview/preview-video-and-audio/modifying-using-views.html)
- [Adobe：创建和编辑文字](https://helpx.adobe.com/after-effects/desktop/add-text/create-and-edit-text-layers/creating-editing-text-layers.html)
- [Adobe：文字动画](https://helpx.adobe.com/after-effects/desktop/animating-text/text-animation/animating-text.html)
- [Adobe：合成设置](https://helpx.adobe.com/mena_en/after-effects/desktop/work-with-compositions/composition-settings/composition-basics.html)
- [Adobe Media Encoder：导出设置](https://helpx.adobe.com/hu/media-encoder/desktop/encoding-and-exporting/export-settings-reference.html)
- [YouTube：分辨率、帧率与编码建议](https://support.google.com/youtube/answer/1722171?hl=en)
- [Mediabunny：媒体输出与 CanvasSource](https://mediabunny.dev/guide/quick-start)

这些资料用于常见工作流与参数设计，未将预设列表描述为经统计的使用率排名。
