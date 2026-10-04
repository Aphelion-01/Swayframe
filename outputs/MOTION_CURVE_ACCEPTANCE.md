# Motion Curve System 验收与调试

M1～M10 已完成。112 项测试及 typecheck/lint/tests/build 全部通过，9 个场景已实际操作验证。

在 [编辑器](http://127.0.0.1:5174/) 打开 [已验收工程](examples/MotionCurve_Validated.motion.json)。选择“缓动演示”，时间轴点击“动画缓动”；P1/P2 可直接拖动，也可输入 X1/Y1/X2/Y2。开启“曲线编辑器”可查看真实速度与空间路径。

Shift 选中多个相邻关键帧，可跨属性批量应用；“应用范围”切换仅当前区间。支持双侧/出侧/入侧、反转、两种镜像、仅缓动复制粘贴。29 个内置预设一键应用，自定义库跨工程保存，并支持改名、收藏、副本、删除和最近使用。

| 场景 | 结果 | 实际操作证据 |
| --- | --- | --- |
| CASE 1 | PASS | {"time": 0.5, "linearX": 880, "easedX": 1086.8} |
| CASE 2 | PASS | {"overshoot": 122.215, "endpoint": 100} |
| CASE 3 | PASS | {"time": 0.5, "opacity": 31.536} |
| CASE 4 | PASS | {"x": 1086.8, "scale": 68.464, "opacity": 68.464} |
| CASE 5 | PASS | {"name": "验收 · 自定义标题曲线", "before": [0.247, 0.204, 0.58, 1], "after": [0.247, 0.204, 0.58, 1], "method": "完全关闭页面后重开，再从自定义库应用"} |
| CASE 6 | PASS | 真实按钮 Undo/Redo 恢复原缓动和新缓动 |
| CASE 7 | PASS | {"beforeProgress": "0.685", "afterProgress": "0.661", "livePreviewRegression": "pointermove-before-pointerup test PASS"} |
| CASE 8 | PASS | {"outSpeed": 1929.915, "inSpeed": 0, "unit": "px/s", "graphStartY": 53.65, "graphEndY": 211.35} |
| CASE 9 | PASS | 独立空间曲线的 SVG 路径在应用 Ease Out 前后完全一致；仅改变沿路径的时间进度 |

自定义预设验收通过完全关闭页面后重开应用核验，四个控制坐标一致。拖动在松手之前更新临时渲染输入，经真实 pointermove 测试验证；松手仅提交一笔历史。保存文件独立比对确认空间路径控制点、关键帧时间与数值未被 easing 修改。图形界面控制台错误为空。

[阶段记录](MOTION_CURVE_STATUS.md) · [原始 GUI 证据](motion-curve-browser-acceptance.json) · [源码包](MotionEditor_0.3_Source.zip)

## 当前约定

工程格式 0.3.0，可迁移旧 0.1/0.2 文件。标准化曲线第一阶段支持 Linear 与 Cubic Bezier，X 范围 0～1，Y 范围 -10～10。数学族预设是独立贝塞尔近似；真实速度以实际属性导数计算。Spring/Bounce/Elastic 生成器仅预留接口。空间控制点当前用于二维 Position。尖锐或无限端点速度以有限采样近似显示。
