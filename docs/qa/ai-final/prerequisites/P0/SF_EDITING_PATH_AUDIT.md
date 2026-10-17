# SF 真实编辑链路审计

审计日期：2026-10-14（Asia/Shanghai）。本轮只读取产品源码、运行验证、编写审计材料，没有修改业务代码、历史V2-7报告、Git HEAD/分支/index，没有调用付费模型。以下源码链接指向真实1.0.3工作树，不指向当前旧工作区。现场原始记录见 [SF_AUDIT_SNAPSHOT.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_SNAPSHOT.json)。

所有“进入Undo”指正式CommandSystem历史，Agent草稿中的sandbox历史不是用户正式历史；“保存重载”指Scene结果可序列化，不指Undo历史或文件授予跨进程持久化。权限判定不由Transaction.source字段提供。

## A. GUI 创建图层

实际入口：CreateLayerMenu / 工具栏经`editorCommands(store).execute`调用`buildEditorActions`→`createObject`；Canvas拖画图形还存在独立手势入口（Canvas.tsx的onPointerUp创建段）。[src/ui/workspace/editor-actions.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/workspace/editor-actions.ts:48)、[src/ui/workspace/object-actions.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/workspace/object-actions.ts:21)、[CreateLayerMenu](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/workspace/CreateLayerMenu.tsx)、[Canvas](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/Canvas.tsx:1358)。

`createObject`读取当前合成→createLayer(kind)→command(layer.create)→EditorStore.run→transaction(source=human)→CommandSystem.executeTransaction→成功后select。**Command是；Transaction是；一项Undo是；保存重载是**。预览手势只改view，最终commit仍是Command；可保存性总大小例外见AUD-11。GUI没有跨用户ACL；可信GUI不是外部授权网关。对象构造与Agent共享createLayer，Canvas的尺寸/位置手势和菜单的居中创建是不同交互，不能据此断言存在第二套Scene执行系统。

## B. GUI 修改属性

真实属性入口Inspector→AnimatedField.edit；名称/字体等patch入口是Inspector.patch或注册inspector section。[src/ui/AnimatedField.tsx](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/AnimatedField.tsx:74)、[Inspector.patch](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/Inspector.tsx:172)、[src/ui/transform-property-edit.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/transform-property-edit.ts:16)。

普通属性：AnimatedField.edit→store.valueCommand→core/command-system.ts的editPropertyCommand（已有关键帧时改当前帧/新增帧，否则setBase）→store.run。缩放/旋转：transformPropertyEdit→transformItems/transformEditCommands→store.run；NumberField.onPreview仅setPropertyPreview/setPropertyPreviews，getRenderProject合成预览，未直接写正式Scene。[src/ui/editor-store.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/editor-store.ts:707)。

**Command是；Transaction是；完成一次编辑进入Undo是；保存正式结果是、临时预览否**。锁定目标通过各UI/属性更新规则处理；raw layer.patch/delete不是统一ACL，AUD-03证明不可供不可信调用者任意调用。GUI多选与Agent参数编译有不同上层规则，但共享property/editing/transform命令，不建议重写一套属性引擎。

## C. Agent V2 创建图层

AgentPanel显式Core V2 Beta→AgentV2EditorPanel发送→CoreV2EditorController.run→ConversationSession.resolveRequest→createProviderCoreV2→TaskIntentPlanner→TaskRuntime.planAndRun/run→validateIntent→EditorAdapter.prepare/execute→AgentTransaction.execute→AgentToolRegistry.resolve/permission/compile→registerCoreWriteTools的created/createText→createLayer和layer.create。

入口 [src/ui/AgentV2EditorPanel.tsx](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/AgentV2EditorPanel.tsx:31)、[src/ui/core-v2-controller.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/core-v2-controller.ts:20)；执行 [src/agent-v2/runtime.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/runtime.ts:103)、[src/agent-v2/editor-adapter.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/editor-adapter.ts:51)、[src/agent/write-tools.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/write-tools.ts:211)、[src/agent/transaction.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/transaction.ts:17)。临时结果由真实createdOutputs绑定；模型不能自行生成正式UUID。

草稿中的每步在sandbox CommandSystem预验证；EditorAdapter.verify（范围+结果）及render通过后产生Proposal，**不会自动正式写入**。用户接受→controller.accept→TaskRuntime.accept(proposalId)→AgentTransaction.commit→正式executeTransaction(pending)。**Command是；Transaction是（草稿逐步、正式合并一次）；仅接受后一个Undo；接受结果可保存重载**。失败/取消不进入正式历史；引用和会话索引留在Scene外。

权限：工具白名单、严格schema、作用范围/锁定/无创建授权均检查；正式基快照已变更会拒绝。漏洞不能简化成“没有事务”：V2-7创建语义仍不可靠，B1多余对象能形成合法草稿，像素和结构合法不等于满足用户对象数量。原报告及QA拒绝保留；本轮未修复。

## D. Agent V2 修改属性

与C共享发送/规划/执行/接受路径，existing/result引用经session、adapter.assertTarget和Registry解析。setProperty映射executionTool到setPosition/setOpacity等；WRITE编译器propertyEdit→animationEdit→editPropertyCommand；setFill、setFont、setDimensions编译对应property/layer.replace命令。[src/agent/write-tools.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/write-tools.ts:211)、[actions.executionTool](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/actions.ts)、[src/agent-v2/editor-adapter.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/editor-adapter.ts:51)。

**Command是；Transaction是；正式一次Undo；保存重载是**。非目标图层由scope保护。CoreV2EditorController观察正式Project和selection变化取消草稿；TaskRuntime.checkActive/accept和AgentTransaction.commit再检查base身份，不能把旧Agent结果覆盖GUI新值。本轮98测试中的晚到响应/并发修改覆盖是离线时序验证，真实模型质量不能由它推导。

V1也使用AgentTransaction/Registry。V1和V2保留不同规划/会话生命周期，不代表有两个正式Scene引擎；未经审计不得把两者Planner/Registry整体再包装成第三套Gateway。

## E. Undo / Redo

GUI按钮/快捷键绑定→EditorStore.undo/redo（先cancelDrag）→CommandSystem.undo/redo→倒序inverse/正序command→assertProjectState→发布Project并移动历史栈。[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:753)、[src/ui/editor-store.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/editor-store.ts:707)。**执行既有Command；不是新增transaction；原transaction作为栈单位；历史不序列化**。LIFO不会在仍有引用时成功删除Asset，schema覆盖所有合成；AUD-02复现共享引用保护。外部workspace回调及异常不是Scene原子保证，AUD-04；Undo失败异常也未被包装为ok:false，需要限定对外错误契约，不能扩大原子性承诺。

## F. 保存与重新打开工程

桌面文件菜单/快捷键→ProjectService.save/open→store.save或api.project.open→preload.call→installIPC→NativeServices.dispatch→writeProject/readProject。保存saveProject/migrateProject校验→atomicWrite临时文件rename；打开readProject→hydrate链接素材→ProjectService.replace→EditorStore.load→loadProject→CommandSystem.replaceProject清空历史。[src/desktop/project-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/project-service.ts:10)、[apps/desktop/electron/preload.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/preload.ts:9)、[apps/desktop/electron/ipc.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/ipc.ts:7)、[apps/desktop/electron/native-services.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/native-services.ts:14)、[apps/desktop/electron/files.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/files.ts:14)、[src/ui/editor-store.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/editor-store.ts:728)、[src/core/project-io.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-io.ts:130)。

保存是只读Scene + 外部IO，**不新增Scene Command/Undo**；打开使用project.replace系统transaction，随后清空Undo/Redo。可保存UUID/动画/Asset数据；外部链接文件不嵌入，不保证换机器可用。未知版本/无效引用/超20MB拒绝。AUD-05晚到save路径污染、AUD-06打开等待期间GUI丢失已复现；文件原子写入通过不解决工程身份竞态。

## G. Renderer 一帧

Canvas订阅EditorStore→getRenderProject（叠加view预览）→createRenderSnapshot→evaluateProperty/父子变换/相机投影→Canvas2DRenderer.syncAssets/视频prepareMedia→render→drawContent/共享Graph合成。[src/core/renderer-core.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/renderer-core.ts:72)、[src/renderers/canvas2d.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/renderers/canvas2d.ts:38)、[Canvas资源刷新](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/Canvas.tsx:752)。输出另用OutputFrameRenderer.frame和png-export的prepareMedia→render；V2预览AgentSnapshotRenderer.render复用同Renderer。

**不写Command/Transaction/Undo；帧不存Scene；工程重载后可重新求值**。资源缓存的close/dispose不是物理文件删除。AgentSnapshotRenderer当前没有调用prepareMedia；不能把其静态图层预览当作音视频完整视觉验收。导出/GUI/Agent包装器具有用途差别，底层Renderer仍共享；颜色/坐标及可信边界见资产审计。

## H. 导入图片

AssetsPanel文件选择/Canvas拖入→importImageFile；native分支→importNativeAssets→preload.assets.importFiles→installIPC→NativeServices.assets.import→NativeAssets.import（FileGrants.requireRead、readImage格式/大小校验、register协议URL）→linkedAsset fetch/createImageBitmap→store.run(asset.add + layer.create)。[src/desktop/asset-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/asset-service.ts:57)、[src/ui/asset-import.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/asset-import.ts:10)、[apps/desktop/electron/assets.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/assets.ts:9)、[apps/desktop/electron/ipc.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/ipc.ts:7)。

Web分支readFile(dataUrl)→createImageBitmap→构造嵌入Asset→同一个asset.add + layer.create transaction。**Command是；每个文件Transaction是；成功一次Undo；多文件native逐个提交，不是整批原子；保存metadata/dataUrl，native不复制二进制**。导入既有Asset再次创建Layer不重复asset.add。Undo只移除Scene记录，未unlink用户文件。

AUD-07证明原生等待选择/IO后读取当前Project，能把旧操作的结果写入新工程；后续decode await还没有revision guard。不能宣称仅通过shared Command就已安全。对照importModelFiles已明确检查revision并预检查saveProject，最小修复应复用这种所有权模式而非创建第二资产/导入框架。

## 证据覆盖

现有相关测试：98/98通过，见 [SF_EXISTING_TEST_RESULTS.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_EXISTING_TEST_RESULTS.json)；补充审计断言：11/11通过，见 [SF_AUDIT_REPRO_RESULTS.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO_RESULTS.json) 与 [SF_AUDIT_REPRO.test.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO.test.ts)。AUD-03～08及AUD-11通过表示成功证明边界或复现缺陷，绝不表示缺陷已修好。测试使用独立工程、模拟文件接口/位图/时序，未读取私人素材或密钥。

每条链路至少有上述实际文件/函数及验证或明确未验证边界。完整真实A/B连续Agent动画仍未通过；素材物理文件跨重启/跨机器丢失和全部媒体解码不在本轮完整测试覆盖内。无MCP入口、AI2Comp端到端链路的证据；不编造未实现API。
