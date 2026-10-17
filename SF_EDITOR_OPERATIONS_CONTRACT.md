# SF Editor Operations V0 调用契约

实现：`src/desktop/editor-operations.ts::EditorOperations`。仅 renderer 宿主内 ES module；不是 Node 远程服务、MCP 协议或全新 Command API。由可信集成宿主持有一次 `new EditorOperations(store)`，多次调用共享该实例；关闭宿主调用 dispose。不能每个请求新建实例来绕开 revision/去重限制。

## 公共返回

成功：`{ok:true, context:{projectId, revision}, data:...}`。
失败：`{ok:false, error:CoreError}`，直接复用 `src/agent-v2/errors.ts::CoreError/problem/CoreV2Error`，保留 code/message/phase/field/expected/actual 等字段。仅复用诊断结构，不运行 Agent Planner/Runtime，也不新增第二套全局错误枚举。

`projectId`/layerId/compositionId/requestId 使用既有 idSchema（UUID）。revision 是从成功查询返回的 **不透明 token**，不是版本号或文件 schemaVersion；不得自行构造。参数严格校验，未知字段拒绝。

## 七项能力

| 方法 | 请求 | 成功 data |
|---|---|---|
| getProjectInfo() | 无 | 原 id/name/schemaVersion/activeCompositionId、合成数、资产数；不含素材内容或本地路径 |
| getSceneTree({projectId,revision}) | 明确工程快照 | compositions 和原生层 ID/name/type/parentId/visible/locked；layers 明确 bottom-to-top，不维护独立树 |
| getLayerDetails({projectId,revision,layerId}) | 明确图层，允许非活动合成 | compositionId、原 layer 的 detached 副本、原 layerProperties 的 key/property 列表 |
| getSelection({projectId,revision}) | 明确工程快照 | 原 compositionId、layerIds、time；查询不会改变选择 |
| renderFrame({projectId,revision,compositionId,time,maxDimension?}, options?) | 明确合成/秒数；maxDimension默认1024，2–2048整数 | compositionId/time/width/height/mimeType=image/png/image（data URL） |
| setLayerProperty({projectId,revision,requestId,layerId,property,value,time}, options?) | 明确工程/图层/原生动画属性路径/值/秒数 | 原 transactionId、layerId、propertyId |
| importLayerPackage({projectId,revision,requestId,compositionId,directory}, options?) | 明确目标合成及此前获用户文件访问授权的目录 | 原 importer 的 compositionId/layerIds/addedAssetIds |

options 仅由宿主提供 `{signal?: AbortSignal}`，不作为 JSON 请求字段。MCP 将来的请求取消由可信传输宿主映射，不允许客户端在包络中注入回调/脚本。

### 属性语义

property 必须是 getLayerDetails.properties 中的原生 `key`，例如 `transform.position`、`transform.opacity`、`transform.scale`、`transform.rotation`；也可使用该层实际存在的其他动画属性路径。原生范围和类型仍由正式 Project Schema 校验。

本V0不伪装成任意对象 patch：不支持静态 name/text/width/fill、任意 JSON 路径、解锁或删除；不存在的路径返回 INVALID_ARGUMENTS。图层锁定返回 PERMISSION_DENIED。不读取选区、UI当前播放头、XY链接或临时变换支点。

值使用原生单位：位置为合成像素、scale为比例（1=100%）、opacity为0–1、rotation为原生角度值。time 明确要求位于目标层所在合成范围内，并按原 snapToFrame 处理。有动画时复用 editPropertyCommand 更新/添加该时间关键帧；无动画时修改 baseValue。不会为了外部调用改变原关键帧语义。

正式写入：EditorStore.run → 原 Transaction/Schema/Undo/可保存性检查。source 使用现有 system 标签；这只是审计来源，不是授权证明。

### 导入语义

仅复用 P3 的显式 **已有合成追加** 模式，要求包尺寸与 compositionId 对应合成一致；不默认为当前活动合成，也不提供本轮之外的创建合成指令。非活动目标保持原活动合成和选择；P4 GUI 新建分层合成流程不变。

实际调用原 importLayerPack(store,{directory,targetCompositionId,signal})，不复制其解析、PNG映射、资产注册或提交逻辑。目录仍通过原 IPC/FileGrants/严格路径检查；本模块不自动调用 grantRead/openFolder 或授予任意文件访问权。未授权目录以 import 错误拒绝。source 沿用原 P3 导入的 human 历史标签，不改写内核；不能将此标签当作授权或声称它经过 GUI 确认。

图片继续内嵌同一 Project，源包只读；单笔原生 Undo/Redo、共享资产和保存重载行为与 P3 显式目标模式一致。工程保存是原生独立操作，不由本模块自动写磁盘。

### 渲染语义

只渲染正式 Scene，不包含 UI 选框/未提交预览。复用原 OutputFrameRenderer.init/draw/dispose，包含媒体准备和效果错误检查。输出透明 PNG，sRGB/Alpha 按现有 Renderer约定；不引入另一套合成算法。

该包装器先分配原尺寸画布，因此在分配前限制源合成最多16,777,216像素；输出按长边 maxDimension 等比缩小、不放大，原输出最小边为2；data URL字符数最多8,000,000。同一适配实例同时最多一帧；冲突返回 STALE_BASE(field=operation)，不无限排队。取消不保证中断底层解码的瞬间，但完成后不交付取消/过期帧，资源在 finally 清理。不是通用渲染农场或恶意资源输入的完整隔离系统。

## 并发与 requestId

- 写前必须同时匹配 projectId 和 revision。任何实际 Scene 快照变化使旧 revision 失效，包括删除层、GUI/Agent修改、Undo/Redo、保存后同ID重载和切换工程再切回。
- Selection/播放头变化不使 Scene revision 失效；写操作仍只作用于明确层/时间。
- 严格全工程冲突策略，不做自动合并。即使只修改了另一层，也要重新查询；旧请求不能被宿主自动换新 token 再发送。
- 同一实例最多受理256个写请求 ID，永久保留至该实例关闭，不淘汰历史 ID。已受理的失败/取消请求也不复用 ID。受理点明确位于：包络校验、取消/宿主检查、projectId/revision核对、重复ID/本适配导入忙碌/容量检查之后。此点之前的拒绝不占用新ID；此点之后的目标不存在、锁定、原生值校验、GUI导入忙碌、文件权限或导入失败均占用ID。调用方为新的用户意图生成新UUID，不依赖失败后复用。去重只依据ID，不依据属性/值；不同ID且新revision的合法重复编辑不会被静默删除。
- 重复 ID 返回 REPLAY_FORBIDDEN，不缓存成功响应、不重做、不静默删步骤。成功后立即 Undo、清空原生历史或重新查询，也不能重放该实例已受理的 ID。
- 计数达到256返回 BUDGET_EXCEEDED；由可信宿主显式更新会话，新 nonce 会拒绝所有旧 token。没有跨进程永久幂等账本。原始网络重试包携带旧 token 会冲突；不能拿刷新 token 的新意图冒充旧包安全重放。
- 异步导入期间，第二次外部写返回冲突；重复导入不取消首个请求。若原 GUI 导入已运行，外部导入拒绝，不调用会替换旧任务的原 importer。
- GUI 仍可编辑/切换工程；原 importer 取消旧任务并在提交前拒绝，正式 Scene 不留部分结果。dispose/外部 signal 同样阻止尚未提交的导入。
- 成功发布的同步 Transaction 不允许“中途取消”。已提交成功即返回成功；之后 Undo 由原编辑系统处理，不能把晚到取消谎报为无写入。

## 错误兼容映射

| 请求方关心的情况 | 现有 code / field |
|---|---|
| PROJECT_CHANGED | CONTEXT_STALE / projectId；同ID工程重载为 STALE_BASE / revision |
| OBJECT_NOT_FOUND | INVALID_REFERENCE / layerId 或 compositionId；旧revision先返回冲突 |
| INVALID_PROPERTY | INVALID_ARGUMENTS / property |
| VALIDATION_FAILED | INVALID_ARGUMENTS（包络/原 animValueSchema）；COMMAND_REJECTION / value（原生提交校验） |
| CONFLICT | STALE_BASE / revision或operation；重复requestId为REPLAY_FORBIDDEN / requestId |
| CANCELLED | CANCELLED；关闭宿主同样如此 |
| IMPORT_FAILED | COMMAND_REJECTION / import，保留原生错误消息；归属变化/取消优先返回相应现有码 |
| RENDER_FAILED | VERIFICATION_FAILURE / render；不存在目标、参数/冲突仍用对应代码 |

以上是适配关系，不新增同名别名枚举。错误本身不触发自动 Planner、自动重试或付费请求。
