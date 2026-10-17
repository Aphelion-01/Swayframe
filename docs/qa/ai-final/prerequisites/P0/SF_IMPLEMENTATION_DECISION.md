# SF 最小实施决策（审计结论，不是开发授权）

审计日期：2026-10-14（Asia/Shanghai）。本轮只读取产品源码、运行验证、编写审计材料，没有修改业务代码、历史V2-7报告、Git HEAD/分支/index，没有调用付费模型。以下源码链接指向真实1.0.3工作树，不指向当前旧工作区。现场原始记录见 [SF_AUDIT_SNAPSHOT.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_SNAPSHOT.json)。

**不允许现在进入P1新功能开发。** 用户没有给出独立P1规格，此处按背景中的后续MCP/AI2Comp等能力准入判断，不能擅自补充范围。业务代码未改；本报告不开始Agent重构或任何协议接入。

## 可以直接复用

1. Project/Layer、projectSchema与commandSchema，唯一正式Scene存储是EditorStore持有的CommandSystem；[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:635)、[src/core/project-schema.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-schema.ts:400)。
2. executeTransaction + inverse Undo/Redo，用于纯Scene多命令原子提交；外部IO不能共享该承诺。[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:664)。
3. AgentToolRegistry的实际resolve/compile/verifyResults、AgentTransaction的sandbox/commit/base快照检查；Agent V2 EditorAdapter的scope/target检查与既有13 WRITE工具。[src/agent/tool-registry.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/tool-registry.ts:76)、[src/agent/transaction.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/transaction.ts:17)、[src/agent-v2/editor-adapter.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/editor-adapter.ts:51)。这是现有边界，不能以raw Command绕开它。
4. importNativeAssets/importImageFile、NativeAssets/FileGrants/受限媒体协议、现有模型导入revision guard，均可复用但必须先修异步归属/可保存性缺口。[src/desktop/asset-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/asset-service.ts:57)、[src/ui/asset-import.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/asset-import.ts:10)、[apps/desktop/electron/assets.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/assets.ts:9)、[src/importers/model-import.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/importers/model-import.ts:219)。
5. loadProject/saveProject/migrations、ProjectService及atomicWrite；Renderer snapshot/Canvas2D/Graph；Electron preload.call→installIPC→requestSchema→NativeServices的可信调用链。[src/core/project-io.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-io.ts:130)、[apps/desktop/electron/files.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/files.ts:14)、[src/renderers/canvas2d.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/renderers/canvas2d.ts:38)、[apps/desktop/electron/ipc.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/ipc.ts:7)。

## 是否需要 Editor Operations / Editor Tool API

**不需要预设新增Editor Tool API。** 对纯内存Scene修改，现有Command/Transaction足够作为共享提交入口；它仍必须由可信调用方提供scope/锁定/权限/项目身份检查。`source:'agent'`只是历史来源，不是权限。

**MCP有可能用少量适配复用现有Command/Registry/AgentTransaction，但不是现在“直接调用既有IPC即可完成”。** 当前CommandSystem在renderer，既有DesktopRequest IPC主要提供文件/平台/AI IO，没有现成远程Scene授权入口。将来只允许在已确认的renderer宿主中做少量typed、allowlist、owner/version/cancel/confirmation适配，最终进入既有Transaction。不得暴露任意command或NativeServices.dispatch、eval、grantRead。是否跨进程必须按后续真实部署规格决定；本轮不建立Transport或MCP工具。

**AI2Comp可复用现有解码/导入与asset.add+layer.create提交，当前不能直接把GUI async包装器视作可靠Headless管线。** 待修owner/revision和可保存性校验后，若确实出现非GUI调用需求，可提取现有导入中的“解码metadata→候选Asset/Layer/commands→单次提交→明确结果/错误”纯逻辑，保留Web嵌入/native链接两种策略。生成的新磁盘文件另有暂存/提交/失败清理责任；现有native链接不具备这一完整能力，不假设物理Undo。

## 确实值得提取的最小逻辑

- 导入/relink/添加Asset图层之间重复的异步owner与revision检查、取消和结果返回；参考已存在的importModelFiles检查。提取是否必要需先修复并观察至少两个真实调用点，不能先写全新“Operations Service”。
- 候选Project可保存性预检，统一当前Command结构边界与20MB序列化边界；复用saveProject，不新建第二Project Schema。
- ProjectService内晚到save/open结果的工程身份与dirty处理，应局部完善现有生命周期，而非新Gateway。

GUI的CommandRegistry是界面动作绑定（enabled/context/callback）；AgentToolRegistry是参数schema、权限、引用解析和Command编译。二者职责不同且已存在，不能因为都叫Registry就合并，更不能新增第三套公共Registry。SemanticAction schema是V2语义层，commandSchema是Scene指令层，映射仍使用现有executionTool/compile，不复制成MCP专用业务schema全集。

## 必须先修复的问题

R01晚到save污染新工程path；R02打开等待期间GUI修改丢失；R03导入迟到写错工程；R04成功提交却无法保存。每项已有最小复现AUD-05/06/07/11。R05/R06在任何不可信外部入口前必须明确并落实路径授权/工具范围边界；不是要求重写可信Command所有内部API。

Agent多对象/文字创建R07仍未达准入，但本轮不重构它、不宣称MCP能自动治愈语义错误。V1默认/V2显式Beta保留。workspace回调原子范围、线性颜色、资产GC等不能趁此扩展成大型功能项目。

## 暂时不应该开发

MCP服务/远程插件框架、AI2Comp端到端、第三套Editor Tool API/Registry/Gateway、Agent全面重构/默认切换、全局冲突自动合并、跨磁盘万能事务、物理资产GC/HDR/Renderer改造。无用户后续任务授权即不实施。

## 修订后的最小开发顺序与P1门槛

1. 用户确认基线后，在1.0.3明确提交上新建独立修复worktree；旧dirty工作区与历史报告只读保留，定义P1实际输入、调用宿主与权限范围。
2. 局部修复ProjectService save/open所有权与等待期间修改保护；AUD-05/06应从“断言问题存在”改为新增正式回归“问题被阻止”，同时保留本次审计证据。
3. 局部修复图片/音视频/relink/addAssetLayer所有权、取消和可保存性预检，复用Command/Transaction及模型导入已有guard；覆盖切换工程、同ID重载、失败Undo/Redo、共享素材及20MB边界。
4. 验证不可信路径不会隐式获得本地文件权限，scope不因Transport扩大；复用现有IPC sender/frame/schema校验。未确定信任策略不进入外部入口。
5. 通过上述修复回归、lint/typecheck/tests/build/Electron smoke、保存重载与真实素材测试后，再评估是否允许**限定范围的P1适配**；只在发现真实重复时提取少量逻辑。Agent创建可靠性按单独准入验证，不用fixture或单次编辑对照取代。

当前gate=**NO / NOT READY**。基础系统已确认，可复用；问题也已可复现，因此无需假想更大架构来继续。下一步是另行授权的局部边界修复，本轮到审计报告为止。
