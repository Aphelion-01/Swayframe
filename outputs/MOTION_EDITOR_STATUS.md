# 编辑器扩展开发状态

执行基线：`docs/baseline/MOTION_EDITOR_PHASE_A_I.txt`。按 Phase A→I 完成；历史 T0～T10 保留，新任务覆盖原基础遮罩、效果和 3D 禁令。

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| A 模型 / 命令 / 历史 | 完成 | 18 文件 / 71 测试；[门禁记录](quality/Phase_A.log) |
| B 画布 / 变换 | 完成 | 19 文件 / 72 测试；[门禁记录](quality/Phase_B.log) |
| C 时间轴 / 动画 | 完成 | 20 文件 / 74 测试；[门禁记录](quality/Phase_C.log) |
| D 曲线编辑 | 完成 | 22 文件 / 77 测试；[门禁记录](quality/Phase_D.log) |
| E 图形 / 文字 / 路径 | 完成 | 24 文件 / 80 测试；[门禁记录](quality/Phase_E.log) |
| F 遮罩 / 效果 / 颜色 | 完成 | 26 文件 / 83 测试；[门禁记录](quality/Phase_F.log) |
| G 预合成 / 父级 / 时间编辑 | 完成 | 27 文件 / 85 测试；[门禁记录](quality/Phase_G.log) |
| H 平面 3D / 摄像机 | 完成 | 28 文件 / 87 测试；[门禁记录](quality/Phase_H.log) |
| I 导入 / 导出 / 性能 | 完成 | 30 文件 / 91 测试；[门禁记录](quality/Phase_I.log) |

| 场景 | 结果 | 实际操作证据 |
| --- | --- | --- |
| CASE01 | PASS | 主矩形 0→1 秒入场淡入，0.5 秒 X=707.715、opacity=50%，Graph EaseOut，填充 #ff7043 |
| CASE02 | PASS | 圆缩放 0→115%→100%，速度曲线可查看并修改，缓出实际应用 |
| CASE03 | PASS | 文字 content/font/size72/tracking6/weight700/color 可编辑，位置及透明度动画 |
| CASE04 | PASS | 5 点 BezierPath 点及切线编辑，填充 #845dff、描边 #ffdd70、宽度10 |
| CASE05 | PASS | PNG 导入，椭圆遮罩、12px 羽化与同拓扑路径关键帧动画 |
| CASE06 | PASS | 曝光0.5 + Hue60/Sat-20 + blur5，效果顺序可调整，实际像素处理 |
| CASE07 | PASS | Null 旋转30°，矩形与圆以它为父级，已有动画整体重定位并跟随 |
| CASE08 | PASS | 三层含 Null 父级预合成，合成数量2，主合成中的预合成图层可动画，内部编辑入口可用 |
| CASE09 | PASS | 同一assetId复用三图层，Z=-200/0/200，卡片Y旋转；Camera Z -1000→-600，画布截图像素变化，控制台无错误 |
| CASE10 | PASS | 真实保存后完全关闭页面，新页面自动恢复并显式重载文件；CameraZ恢复、历史清空；再次保存与原文件逐字节一致 |
| CASE11 | PASS | 实际 GUI 输出3帧1920×1080 PNG，30fps，首帧与单帧导出字节一致；桌面画布缩放比较平均RGB差3.223/255，ZIP CRC通过 |

最后门禁：30 个测试文件、91 项测试通过；typecheck/lint/tests/build 全部通过。真实浏览器验收在 127.0.0.1:5174 完成，控制台错误为空。详细证据见 `motion-editor-browser-acceptance.json` 与 `png-export-acceptance.json`。
