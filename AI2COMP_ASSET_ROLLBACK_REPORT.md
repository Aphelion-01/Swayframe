# AI2Comp 资产与回滚

**限定V0内嵌PNG路径：GO。** 可靠性来自不产生独立素材写入 + 既有可保存Scene事务，不来自虚构的跨文件事务。

| 情况 | 策略与真实证据 |
|---|---|
| 文件复制失败/部分复制 | V0不执行文件复制；真实文件读取/编码逐个暂存。损坏第二张PNG时，已完成的第一张不会成为正式Asset/Layer。C-corrupt实测Scene/Undo/Redo不变。 |
| 重名 | SF图层/Asset使用新UUID，不按basename覆盖；允许相同显示名，数据不同即独立Asset。 |
| 相同内容 | 对无source的现有原生PNG Asset及本批新资产，以完整dataUrl相等复用。不同文件名但相同字节可共享；不按名字或感知相似合并。原生SHA256仅用于准备证据，不新增Asset Schema字段。 |
| Undo / Redo | 一项Transaction；只为本次新Asset提交asset.add。复用资产不加也不删；二次相同包导入addedAssetIds=0，Undo保留首个合成仍引用的全部素材；Redo不复制资产。 |
| 共享引用 | 原projectSchema跨合成验证assetId引用；asset.remove仍有引用会原子拒绝。没有unlink用户PNG或物理GC，不能误删其他图层的源文件。 |
| 源包删除 | 真实保存后删除QA复制的A包；同进程关闭重开及第二独立Electron进程都恢复3层/3素材并渲染通过。公开样例包和用户目录不删除。 |
| 取消 | read/decoder前后guard + Native cancel + owner token；真实IO完成但返回被暂停时取消，再释放结果，Scene和历史不变。 |
| 切换工程/删除目标 | 真正替换Project或删除目标合成后释放旧读取结果，导入拒绝；新Scene与历史保持最新用户修改。 |
| 新导入替代旧导入 | WeakMap运行token + 请求ID；第二次请求胜出，仅提交一个完整合成和一项Undo。 |
| 事务中途失败 | QA在真实导入Commands末尾注入不存在layerId的layer.delete；原CommandSystem拒绝，已有资产add及composition.add均不发布，无半合成。 |
| 大工程无法保存 | 真实生成不同随机RGBA PNG；原Scene放两份有效内嵌PNG后再导入独立噪声PNG，候选超过20MB。原saveProject预检拒绝、Scene/Undo/Redo完全不变，原工程仍可保存。不是用无效Base64冒充可解码图片。 |
| 保存磁盘失败 | 沿用P1原ProjectService + atomicWrite。不是导入内部文件写入；本轮未注入磁盘空间耗尽，不标为该项新增自动化PASS。完整已导入Scene/dirty可重试，保存失败不声称导入文件已持久化。 |

上述真实检查在 `docs/qa/ai2comp/runs/final-i/`；较早final-c/d/e覆盖17项主体路径。大小拒绝错误应为 `Layer Package：提交失败，工程未更改：工程文件超过 20 MB`，详见combined-project-too-large.json。

## 路径和资源拒绝

`tests/layerpack.test.ts`真实临时文件系统验证文件/目录符号链接、绝对路径、URL、反斜杠、百分号、../、缺失文件、额外脚本文件、文件/总包大小、manifest大小、CRC、巨大IHDR和小尺寸头+解压炸弹。该单元测试的nativeImage为明确stub，仅隔离元数据/路径检查；真实解码另由Electron报告证明。没有把stub称端到端成功。

## 资产归属与停止边界

持久化成功定义为完整Scene通过可保存性事务，用户保存后由独立进程读取工程和内嵌图像并渲染成功。不是“暂时显示了几层”。V0最大包/工程容量有限，超过上限整体拒绝，不降采样、不丢图层、不变更原20MB标准。

若后续需支持大包、项目旁的外部托管文件、跨文件导入写入或自动GC，必须另立明确staging/ownership/rollback协议，本阶段停止在内嵌策略，不扩展到这些能力。
