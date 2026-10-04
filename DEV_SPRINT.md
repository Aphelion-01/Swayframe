# Current Goal

按 `docs/baseline/DEV_SPRINT_V2.txt` 自主推进完整创作流程。先完成 CG 桌面收尾，再优先修复连续交互与 Canvas/Timeline 操作问题，复用既有 Command/Property/Graph。

# In Progress

本轮完成，无挂起开发；已交付 0.6.1，下一轮按下列高价值任务推进。

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

1. 多行文字的自动测量、文字框边界与画布内编辑浮层。
2. 大工程真实播放/拖动帧耗时测量，定位 React/Canvas 耗时。
3. Windows 实机安装、重开、导出、DPI 与文件关联验收。
4. 父级剪切/负缩放组合下的选框、锚点与多选变换回归。
5. Linked Asset 跨目录迁移、重链接和恢复流程的原生 GUI 回归。

# Known Regressions

未发现门禁回归；Canvas 过期手势、Timeline 越界预览与捕获取消已修复。

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
