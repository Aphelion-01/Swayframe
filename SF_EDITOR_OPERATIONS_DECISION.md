# SF 最小编辑操作入口决策

**结论：需要一个 renderer 宿主内薄适配；不需要新增共享编辑内核 API、Editor Tool API 框架、Registry 或 Gateway。** 现有 Command 已足够执行正式编辑；缺少的是外部调用的工程归属、跨调用 revision 和重复请求拒绝。直接暴露任意 Command 不满足这些边界，强制走 Agent Planner 也不合适。

基线：P4 `263a47c`，独立分支 `codex/editor-operations-v0`。P0 的五份审计、P1 三份验收、P3 导入架构/资产回滚/验收及 P4 UI/Electron 报告已核对。沿用 P1/P3 的所有权和可保存性修复；原 dirty 工作区、历史冻结报告不修改。

## 已有接口与复用判断

| 系统 | 真实入口 | 判断 |
|---|---|---|
| Command/Transaction | `src/core/command-system.ts::CommandSystem.executeTransaction`、`editPropertyCommand`；`src/ui/editor-store.ts::run` | 正式 Scene 单次发布、逆命令 Undo/Redo、saveProject 候选预检均复用。不增加执行引擎。source 不是权限 |
| 原生查询 | `CommandSystem.getSnapshot`、`EditorStore.getSnapshot`；`src/core/project-model.ts::layerProperties/findProperty` | 直接投影原不可变 Scene 和选择；不维护另一棵树/Scene Model |
| Agent 查询 | `src/agent/read-tools.ts::registerReadTools` 的 inspectProject/listLayers/inspectLayer/inspectSelection | 是现有 Agent Registry 内回调；部分限当前合成/50条或上下文预算。外部入口不为查询再实例化 Registry，薄投影只读同一原生快照，无另一套查询算法 |
| Agent V2 Adapter | `src/agent-v2/editor-adapter.ts::EditorAdapter` 构造 MutationScope/AgentTransaction；prepare/commit | 为 Agent 隔离草稿服务，不是外部调用必经入口。保持 Planner/Runtime/Action Schema/Adapter 不变 |
| Renderer | `src/renderers/output-frame.ts::OutputFrameRenderer.init/draw/dispose` → 原 Canvas2DRenderer | 已处理资源、prepareMedia、效果错误和输出适配，直接复用；不用 AgentSnapshotRenderer 的视觉缩略图包装替代正式帧 |
| 资产导入 | `src/importers/layerpack-import.ts::importLayerPack` → 原 native Reader/FileGrants/单次 Transaction | 直接复用 P3 的显式 targetCompositionId 追加模式、内嵌 PNG、取消/所有权检查和共享资产 Undo |
| 保存 | 原 ProjectService/saveProject/atomicWrite | 不新增保存端点或序列化；验证写后可保存/重开 |

## 本轮最小改动

- 新增 `src/desktop/editor-operations.ts::EditorOperations`：仅7种指定操作，输入包络、原生诊断结果、短期 revision、一次性 requestId 拒绝表及异步清理。
- `vite.config.ts` 增加静态 editorOperations 构建入口，保留 ES module 的类导出，便于可信 renderer 宿主导入。没有自动创建实例、打开端口或暴露 IPC。
- 没有修改 Command/Scene/Renderer/Importer、Agent V1/V2 或 GUI 的实现。没有新增常驻按钮、Feature Registry/动作注册中心、Planner、脚本语言或批处理 DSL。
- 查询 DTO 只列原生字段；属性路径由原 layerProperties 提供，值与正式提交沿用原 animValueSchema/Command/Project Schema。

## 调用边界

GUI → 原 Command/Transaction；Agent V2 → 原 Planner/Runtime/EditorAdapter/AgentTransaction → 原 Command；外部可信宿主 → 本薄适配 → 同一原生查询/渲染/导入/Command。

MCP 客户端将来可以由有限的传输映射调用这7个方法，不经过 Agent V2 Planner。但本轮**没有实现 MCP 服务、身份授权或远程 IPC**。模块只接受可信宿主持有的 EditorStore；显式 ID 不等于权限。未来宿主必须先验证用户授权，不能把原 NativeServices.dispatch/grantRead、raw Command 或任意路径授权暴露给客户端。

## 冲突保护为何必要

Project 只有文件格式 schemaVersion，没有持久编辑 revision。原 CommandSystem 的事务 ID 重复检查只覆盖当前 Undo/Redo 栈；历史清空后不能作为外部请求的永久幂等保证。

因此不修改核心模型，只观察原快照身份：每个适配实例一个随机会话 nonce + 单调计数。GUI、Agent、Undo/Redo、同ID重载、切换合成/工程触发实际 Scene 快照变化时计数递增；Selection、播放头、布局不构成 Scene revision。旧会话 token 不跨重启复用。写入前严格比较 projectId/revision；不自动重定位选区、不自动刷新重放旧请求。

原生导入负责异步提交检查；薄适配不会在成功提交后把晚到取消误报为“未修改”。渲染捕获原快照，异步结束检查版本，过期帧不返回成功。详细策略见 CONTRACT。

## GO / No-Go

**GO：作为7个有限操作的宿主内调用基线。** 899项回归、17项真实Electron检查通过，无付费/网络调用。查询、Undo/保存、过期目标、异步取消、重复提交和 P3 导入均有证据。

**No-Go：直接上线面向外部的 MCP/HTTP/任意 IPC 服务。** 本轮没有认证、授权传输或任意客户端的安全沙箱，也没有跨进程永久 exactly-once 保证；不得将本轮 GO 推导为远程安全发布。没有理由建立通用 Gateway 或第二套编辑 API。后续若有具体传输任务，只做有授权的有限映射，不扩大本模块能力表。
