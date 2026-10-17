# SF 实际Renderer Golden Cases

**两轮全部像素/结构断言通过。** 输出来自原Canvas2DRenderer，不是重写的参考Renderer。Golden指明确场景与断言，不是把当前输出直接当唯一正确答案。

## 源码和色彩约定

[src/core/renderer-core.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/src/core/renderer-core.ts:72)→evaluateProperty / transform2D→[src/renderers/canvas2d.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/src/renderers/canvas2d.ts:38).syncAssets/prepareMedia/render→drawContent与现有Graph。320×180，outputScale=1，drawHandles=false，不把UI选框计入图像。浏览器ImageData实际colorSpace为`srgb`；8-bit RGBA、straight-alpha读回。输入Color为0..1，CSS通道0..255，没有宣称线性光/HDR/ICC一致性。

内部实心区域RGBA每通道容差≤2：来源是8-bit alpha量化（0.5约128/255）与Canvas source-over通道取整，非从当前差异反推放宽。背景blue(0,0,255)，半透明red(255,0,0)叠加按字节通道计算期望(128,0,127,255)。不在抗锯齿边缘做固定颜色断言。

## Golden断言

| case | 明确断言 / 实测 |
|---|---|
| frame-0 / t=0 | (80,90)=[128, 0, 127, 255]，(160,90)=[0, 0, 255, 255] |
| frame-1 / t=1 | (80,90)=[0, 0, 255, 255]，(160,90)=[128, 0, 127, 255]；Snapshot位置80→160，Y90不变 |
| 图层顺序 | 蓝背景layer.reorder到最上层后，形状中心变blue；Undo恢复原Scene和顺序 |
| 可见性 | shape.visible=false后中心为blue；Undo恢复 |
| Alpha | 隐藏背景并transparentBackground=true，形状内部期望(255,0,0,128)，空白(5,5)期望(0,0,0,0) |
| 文字 | 内容SF、fontSize32、sans-serif；实际白字像素计数246，断言>10；不以系统字形逐像素作为跨平台契约 |
| 图片 | 原生导入8×8不透明黄PNG，在(160,90)期望(255,255,0,255)；真实协议/解码/Bitmap经过Renderer |

结构和像素同时检查，未采用“render没抛异常”作为通过条件。六份PNG在final-a与final-b的SHA256全部相同；仅说明这台Mac和当前字体环境下可重复，不推导Windows/其他字体版本逐像素一致。

## 实际产物

- [frame-0.png](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/frame-0.png) / [frame-1.png](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/frame-1.png)
- [background-on-top.png](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/background-on-top.png) / [shape-hidden.png](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/shape-hidden.png)
- [transparent.png](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/transparent.png) / [imported-image.png](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/imported-image.png)
- [frames.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/frames.json)：Scene图层位置、opacity、visible、ImageData色彩空间及样本。

![真实0秒帧](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/frame-0.png)

![真实1秒帧](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/frame-1.png)

运行：`node work/minimal-qa/run.mjs new-run-name`（工作目录与前置条件见SF_MINIMAL_ACCEPTANCE_BASELINE.md）。本轮没有修改字体/抗锯齿、渐变算法或Renderer语义来让像素断言通过。
