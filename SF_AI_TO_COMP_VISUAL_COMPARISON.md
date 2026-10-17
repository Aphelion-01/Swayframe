# SF AI-to-Composition — Visual Comparison

**视觉限定PASS。** 原始参考指外部工具按明确设计生成的960×540标题合成，不是NASA原照片，也不意味着恢复了原照片的隐藏分层。

## 素材和设计来源

`docs/qa/external-ai/source.png`来自P7公开NASA astronaut摄影样例（来源及许可见`docs/qa/segmentation/inputs/ATTRIBUTION.md`）。本轮重新调用原P7 Vision生成真实主体Alpha，原始输出保留在`p7-output/*/analysis/`。输入hash/模型revision/耗时见provenance和design-provenance.json。

背景、圆弧、定位角、网格和文字由当前Codex编写本地确定性绘图脚本产生。不是付费图像模型输出，也没有用预抠PNG冒充本轮分割。人物以预乘方式过滤缩小到370×370，再保存为straight RGBA8 PNG，避免resize时二次乘Alpha产生黑边。输出标题为Raster，未做OCR/字体推断/原生Text转换。没有随包分发字体文件或模型权重。

外部参考：`docs/qa/external-ai/reference.png`；真实SF导入：`final-run/imported.png`；动画两帧：`final-run/animation-0.png`、`animation-1.png`；并排图：`final-run/visual-comparison.png`。差分×32和独立expected图一并保留。

## 像素断言

SF图全部来自真实MCP image block→原生`OutputFrameRenderer`，独立预期由Python/PIL仅用于诊断，不替代产品Renderer。容差沿用P3/P6每通道2，覆盖8-bit sRGB Canvas/PIL Alpha舍入，不按结果扩大容差。

| 对比 | 最大单通道差 | 超出容差通道数 | 结论 |
|---|---:|---:|---|
| 外部参考 vs SF导入 | 1 | 0 | PASS |
| 主体平移后t=0独立预期 vs SF | 1 | 0 | PASS |
| 主体t=1独立预期 vs SF | 1 | 0 | PASS |
| 保存重开t=1 vs 独立预期 | 1 | 0 | PASS |

完整数据见`final-run/visual-report.json`。动画主体从左上(525,108)移到(579,96)，变化93878像素，变化bounds=[535,105,949,478]，主体两个矩形并集之外变化为0。不是仅凭两帧hash不同判定动画正确。

使用sRGB编码值source-over、RGBA8、画布原点左上、像素坐标，非线性光/HDR。原参考与导入对比以相同像素尺寸进行，不对截图UI缩放后的画面做错误像素对照。

## 实际目视差异与局限

参考与SF导入没有明显排版、叠层、裁切或透明度偏差；动画仅主体移动，标题和装饰保持固定。`final-editor.png`为真实工程在t=0的GUI截图，不冒充t=1画面；t=1以独立导出PNG为证据。

人物底部是原照片裁切边界，保留明显水平结束，未推测身体。毛发/头盔部分软边仍含原照片混色，异色背景可能见细边；本轮没有RGB去污染、精细matting或Inpainting。换用原创深色设计背景只是在新设计中承载主体，不是恢复被人物遮挡的原背景。重合像素通过证明导入保真，不能证明分割对所有图片正确。
