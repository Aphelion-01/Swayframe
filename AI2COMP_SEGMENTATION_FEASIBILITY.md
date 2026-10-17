# AI2Comp V0.1 — 本地分层可行性

日期：2026-10-16。结论：Apple Silicon Mac 的受限双层原型可运行；不是任意图片自动还原，不包含隐藏背景补全。Windows 本地分割不可用。

## 已确认环境

本轮机器为 Apple M5（10核CPU/10核GPU）、16GB统一内存，macOS 27.0.1 build26A434；Swift/Xcode 可编译。系统 Python 未安装 torch / transformers / onnxruntime / rembg / OpenCV；附带 Python 有 PIL、numpy，仅用于产物诊断。没有下载安装新权重，没有付费云 API 或照片外发。

实际后端：系统公共 `VNGenerateForegroundInstanceMaskRequest`，固定 revision 1，合并 `allInstances` 为一个 Main Subject。不是利用缓存中的私有模型接口。SDK声明支持macOS14+；本产品此次仅编译/开放 arm64。首次受限沙箱探测出现 ANE error9，本机正常 Electron 权限下三图成功，因此不能将受限探测失败解释为机器无模型。原始探测程序见 `work/segmentation/probe.swift`；正式输出来源以 `generated/*/analysis/provenance.json` 为准。

[Apple Vision API](https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest)。许可边界见 AI2COMP_MODEL_LICENSE_REVIEW.md。

## 实现与复用

- `apps/desktop/native/segment-image.swift::run`：ImageIO类型/尺寸/单帧验证、EXIF方向及sRGB转换、1024缩小、公共Vision调用、原始mask读回。
- `apps/desktop/electron/image-layers.ts::LocalImageLayers.generate`：现有FileGrants授权、不可变源快照、定长受控helper、RGBA8 PNG、标准P3包，staging→rename；不接触Scene。
- `src/ui/LayerPackImportDialog.tsx::generate / choose`：复用原Modal和`importLayerPack`的预览、确认、Command事务、撤销及资产持久化。未确认不修改正式Scene。
- `src/importers/layerpack-import.ts::importLayerPack` 原样复用；没有第二Scene、Command、Renderer或AI2Comp专属属性系统。
- `src/shared/feature-catalog.ts`仅登记元数据；`src/ui/workspace/editor-actions.ts`在原typed Command Registry绑定事件。

已核对 P3 `AI2COMP_MANIFEST_V1.md`、`AI2COMP_IMPORT_ARCHITECTURE.md` 及 P4 `AI2COMP_EDITOR_UI_REPORT.md`。导出显式 `srgb` / `straight` / `bottom-to-top`，原点左上、像素、完整画布 bounds。reference只参考，不成为图层。analysis位于composition目录之外，不新增私有manifest字段。

## 资源和适用范围

输入12MB以内、单帧不透明PNG/JPEG，单边≤8192、总像素≤16777216；输出最长边1024，UI在选择和确认阶段说明缩小。单任务、60秒helper上限、12MB输出缓冲；原Importer文件/包限额继续生效。拒绝预透明素材、非法格式/坏图/空或全前景mask；不推断第三层或深度顺序。

三照片完整生成耗时约999/237/232ms（首轮冷启动在内，不是恒定性能承诺），初始探测峰值RSS约53.3MB只指helper，不是整个Electron进程。正式每图模型耗时见provenance；不以三小图推断4K吞吐量。

无已验可调用Inpainting后端；本阶段没有修补。背景主体内部明确透明，生成隐藏像素为0。软边保留混色，发丝、胡须和物理透明物体不保证质量。多物体可能被合并，人物/器物语义层不能由此保证。

## 资产及隔离

生成前只读用户明确选中的图片及输出目录授权；NOFOLLOW/文件状态复核后先复制私有快照，hash与模型输入一致。helper固定路径execFile，无shell、不执行照片内容。自建stage写失败/取消清理，成功一次rename产生完整可保存包；不宣称文件系统与Scene有跨系统原子事务。

完成导出的包属于用户输出；其后取消导入/切工程/Undo不会删除该文件。正式资产由原P3内嵌工程数据保存，不依赖临时目录。GUI/工程变化或取消使晚到结果不能自动导入；原P3继续二次身份/事务校验。窗口关闭取消本机任务。

Go：限定Mac摄影分层动效原型。No-Go：Windows分割、精细matting、自动隐藏背景恢复、任意图片层级还原。不得以本次通过扩展上述范围。
