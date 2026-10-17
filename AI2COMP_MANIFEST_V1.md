# AI2Comp Layer Package manifest v1

V0 入口：桌面版「文件 → 导入图层包…」，选择目录。默认导入到当前工程的一个新合成；不是打开/替换工程。无 AI 调用。规范以 `src/importers/layerpack-manifest.ts::layerPackManifestSchema` 为准。

```json
{
  "format": "swayframe.layerpack",
  "version": 1,
  "colorSpace": "srgb",
  "alphaMode": "straight",
  "order": "bottom-to-top",
  "canvas": { "width": 1080, "height": 1920 },
  "layers": [
    {
      "id": "background",
      "name": "Background",
      "type": "raster",
      "asset": "layers/background.png",
      "bounds": { "x": 0, "y": 0, "width": 1080, "height": 1920 },
      "opacity": 1
    }
  ]
}
```

## 文件与字段

- 根目录必须有 `manifest.json`；可有 `reference.png`，以及 manifest 引用的 `layers/` 下 PNG。不支持的额外文件（包括脚本、隐藏文件）、符号链接和特殊文件均拒绝。所有字段对象使用 strict Schema，未知字段拒绝，不静默忽略旋转、混合模式、效果或变换。
- `format`、`version`、`canvas`、`layers` 必需。`colorSpace`、`alphaMode`、`order` 可省略，分别默认 srgb / straight / bottom-to-top；不接受其他值。opacity 可省略，默认1。
- `id` 为包内唯一的字母开头、最多64字符的 ASCII 字母/数字/下划线/连字符标识；不作为 SF UUID。name 为1～200字符，允许重名。导入时为图层/属性/合成生成原生UUID。
- 原点左上，X右、Y下，单位为合成像素。bounds 的 x/y 是非负整数，width/height 是正整数，矩形必须完全位于 canvas 内。
- PNG 实际像素尺寸必须等于 bounds.width/height，禁止隐式拉伸。映射 SF 中心 position=`(x+width/2,y+height/2)`，原生 width/height 保留，scale=1、rotation=0、anchor使用原生默认。裁切位置不丢失。
- layers 从数组首项（最底）到末项（最顶）叠加。Outliner 按原生规则逆序显示最顶层。导入已有合成时，新增图层整体位于原图层上方，数组内部顺序不变。
- opacity 为0～1，乘以 PNG 每像素 Alpha，映射原生 transform.opacity；不是将 Alpha 烘焙进图片。
- `reference.png` 可选，必须是与 canvas 等大的受支持 PNG。只校验，不创建图层、Asset、UUID或持久引用。

## PNG、Alpha 与颜色

V0 明确限定：非隔行、8-bit RGBA（PNG color type 6）PNG，straight/unassociated Alpha，sRGB。未标记 PNG 按本格式约定解释为 sRGB；不做 ICC 猜测或自动转换。RGB/灰度/索引色/16-bit/隔行/APNG、iCCP 与其他不支持的 chunk 拒绝，需先导出为上述格式。

接受 IHDR/IDAT/IEND，以及 sRGB、标准sRGB gAMA=45455、标准sRGB cHRM、合法pHYs；DPI元数据不改变像素尺寸。所有 chunk 验证长度、CRC、次序；IDAT 解压有最大输出长度，并验证扫描行长度、filter 类型、压缩流完整性，再调用 Electron nativeImage 解码。完整像素解码与 bounds 比对后才准备资产。

SF 沿用真实 Canvas2DRenderer 和 source-over；PNG bytes 保持 straight，不对 RGB 手动再乘 Alpha。Chromium 的 Canvas 内部预乘由其解码/合成流程管理，ImageData 为 sRGB 8-bit straight-alpha 读回，Alpha0的RGB归零。没有声称线性光合成、HDR或跨平台ICC完全一致。

## 资源上限（十进制 bytes）

| 项目 | V0上限 |
|---|---:|
| manifest | 128000 bytes |
| 单文件PNG | 8000000 bytes |
| 包内所有文件（含reference/manifest） | 12000000 bytes |
| 图层 | 32 |
| 单边尺寸 | 8192 pixels |
| 画布 | 16777216 pixels |
| 单张PNG（含reference） | 8388608 pixels |
| 图层总像素（重复引用也重复计数） | 24000000 pixels |
| 文件 | 66；另有目录条目和深度限制 |
| 子目录深度 | 8 |
| 最终原生工程 | 原有20 MB限制，不能因包小于12 MB而绕过 |

路径必须是 `layers/` 下的 `/` 分隔相对 `.png` 路径，最长512字符。拒绝绝对路径、空段、`.`/`..`、反斜杠、NUL、冒号、百分号、查询/片段、URL/网络路径。root 是用户选择目录的 realpath；内部任何符号链接都拒绝。名字完全匹配实际文件，不做跨文件系统名称规范化猜测。

同一PNG可被多个条目引用，但图层ID必须不同且分别计入像素预算。重复内容按完整PNG字节/dataUrl复用原生Asset，不做感知图像去重。

## 原生格式映射

SF已有完整 `.swayframe` Project schemaVersion 0.7.0，内含完整Scene和UUID，不是文件夹 manifest 协议。本v1只是最小外部导入描述，最终只生成原生 Asset / image Layer / Composition 和既有 Commands；不建立第二Scene、Schema迁移器或Renderer。

真实样例在 `docs/qa/ai2comp/packages/`：A完整透明画布；B裁切图；C-path路径错误；C-corrupt损坏图片；E-opacity额外验证opacity。使用 `node work/ai2comp-qa/fixtures.mjs` 可确定性重建。
