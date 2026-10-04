# Motion Curve 开发状态

执行基线：docs/baseline/MOTION_CURVE_M1_M10.txt。按 M1→M10 顺序完成；各阶段完成后运行完整质量门禁，最后 39 个测试文件、112 项测试全部通过。

| 阶段 | 状态 | 验证 |
| --- | --- | --- |
| M1 Cubic Bezier 数学与求逆 | 完成 | 94 项测试；[原始门禁](quality/M1.log) |
| M2 MotionCurve 模型与区间适配 | 完成 | 96 项测试；[原始门禁](quality/M2.log) |
| M3 动画引擎与空间路径 | 完成 | 98 项测试；[原始门禁](quality/M3.log) |
| M4 共享命令 / Undo | 完成 | 100 项测试；[原始门禁](quality/M4.log) |
| M5 标准化曲线 UI | 完成 | 100 项测试；[原始门禁](quality/M5.log) |
| M6 实时预览 | 完成 | 101 项测试；[原始门禁](quality/M6.log) |
| M7 预设库 | 完成 | 104 项测试；[原始门禁](quality/M7.log) |
| M8 时间轴 / Mixed | 完成 | 105 项测试；[原始门禁](quality/M8.log) |
| M9 真实速度图 | 完成 | 107 项测试；[原始门禁](quality/M9.log) |
| M10 复制粘贴 / 反转 / 多选 | 完成 | 112 项测试；[原始门禁](quality/M10.log) |

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

核心实现与 API 说明见 docs/MOTION_CURVE_SYSTEM.md。真实 GUI 验收证据见 motion-curve-browser-acceptance.json。当前本地预览 127.0.0.1:5174，控制台错误为空。
