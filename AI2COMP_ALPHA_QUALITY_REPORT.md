# AI2Comp V0.1 — Alpha质量

结论：结构和原始mask传递通过；边缘质量有限。没有GT mask，不报告IoU或通用分割准确率，不宣称精细抠图。

## 显式像素规则

`segment-image.swift`直接读Vision Float32 mask，clamp后量化至8bit，不对Alpha做sRGB gamma。原不透明图片转换到sRGB，生成RGBA8 straight PNG。`encodeLayerPNG`写sRGB标记、不嵌ICC、不二次乘Alpha。

`splitVisibleLayers`：Main Subject使用原RGB和model alpha；alpha0下RGB清0。Background只在alpha255的主体内部清RGBA，其余（含0<alpha<255混色边）保留原图。未进行RGB去污染。原始mask、透明洞和不确定边分别保留在analysis PNG，隐藏生成像素为0。

这个背景是“可见背景加不确定原边缘”，不是干净补全背景。两层原位置重合可精确重建，但移动后会露洞及薄残边。不能用重建误差0证明分割质量或光学透明度正确。

| 图 | Alpha等级数 | 不确定边像素 | 主体内部透明背景洞 | Alpha0下非零RGB |
|---|---:|---:|---:|---:|
| A | 255 | 4216 | 102536 | 0 |
| B | 227 | 6714 | 136899 | 0 |
| C | 256 | 5852 | 111118 | 0 |

数据来自 `docs/qa/segmentation/alpha-metrics.json`；Subject Alpha与原model量化mask完全一致，原RGB/方向匹配，原位source-over重建每通道最大差0。SF实际Renderer同样单独验过，不以PIL冒充产品。

## 白/黑/棋盘观察

`alpha/real-image-contact.png`和每图`*-subject-white/black/magenta/checker.png`、`*-edge-inspection.png`保留全图与局部结果。A细胡须漏分、边界部分平滑；B细碎发丝不完整，头盔/装备一起分组；C杯盘勺合并。软边保留原背景颜色，在异色底/移动后有色晕风险。mask分辨率有限，有细节丢失/锯齿风险。三图不是物理半透明物体数据集，不能外推玻璃/烟雾。

失败质量样例和原始蒙版没有后期手改为最佳结果。没有重切素材位置：所有输出同参考画布大小、完整bounds；三图实际Renderer位置/顺序/Alpha重合检查通过。

## 人工修正边界

现有 `src/ui/CompositingControls.tsx::updateMask` 通过原`layer.replace`；`src/renderers/canvas2d.ts`调用`applyMasks`。可复用现有路径/矩形/椭圆Mask及羽化裁掉多余部分，不新增Mask编辑器。本轮自动化未将精细手工Mask修正作为PASS项。

Mask不能恢复已丢失主体像素或隐藏背景。可在输出目录中外部修正`composition/layers/*.png`，保持同名、同尺寸、RGBA8 straight sRGB与manifest一致，再用“导入分层合成…”重新导入。透明PNG的外部修正不再送本地分割。已有工程不自动监听磁盘替换；须显式重新导入，避免静默改图。
