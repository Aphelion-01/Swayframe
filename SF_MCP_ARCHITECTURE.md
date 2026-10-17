# Swayframe MCP Bridge V0

结论：限定七项操作的本机桥接已实现，默认关闭。MCP 是协议适配层，不运行 Planner，不持有第二份工程。正式编辑、导入、渲染继续使用 P5 EditorOperations 与原生内核。真实客户端与正式 dist 的证据见 SF_MCP_REAL_CLIENT_E2E.md。

## 基线与已读前置

独立 worktree `mcp-bridge-v0`，分支 `codex/mcp-bridge-v0`，起点 `9c05fad`（P5）。原 dirty 目录和历史 V2-7 冻结报告没有修改。已核对原目录 docs/audit 的五份 P0 报告、本分支 docs/qa 的 P1 三份报告、P3 五份 AI2Comp 报告、P4 Editor UI/Electron/Workflow 及 P5 三份 Editor Operations 报告。P0 的早期 NO-GO 缺口由 P1/P3 修复承接，不把原冻结版本误当已修复。

## 官方协议与实际依赖

2026-10-15 访问官方 [最新规范](https://modelcontextprotocol.io/specification/latest)（重定向 2026-07-28）、[stdio 规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)、[SDK stdio](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html)、[版本协商](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions.html)、[取消](https://ts.sdk.modelcontextprotocol.io/v2/servers/logging-progress-cancellation.html)、[官方 releases](https://github.com/modelcontextprotocol/typescript-sdk/releases)。没有依据记忆手写 JSON-RPC 协议。

package-lock 实际固定 `@modelcontextprotocol/server` / `core` 2.3.1；开发验收 Client 2.3.1。运行环境 Electron 44.5.1。服务端使用 `McpServer.registerTool`、`serveStdio` 与官方 `StdioServerTransport`；客户端使用官方 `Client` / `StdioClientTransport`。

SDK 同时支持现代与旧协议；特别注意其 `LATEST_PROTOCOL_VERSION` 导出及默认 Client 仍属于 legacy 家族，不能据包版本宣称实际已用最新协议。最终客户端明确 pin `2026-07-28`，采集到 `getProtocolEra()=modern` 和发送包 `_meta` 中实际版本。早期未 pin 的试跑属于 legacy 验证，其 report.protocol 字段只是当时的目标标签，不是 wire 证据。最终证据以 final-e/wireVersions 为准。

现代探测可能启动一次短命兄弟进程。CLI 因此在首次工具调用时才连接编辑器：discover/listTools 不读取 Scene，也不消耗用户的一次连接授权。兼容 legacy 的初始化由 SDK 完成；stdout 只有 SDK 协议消息，日志走 stderr。

## 实际调用链

外部客户端 → stdio 子进程 `apps/desktop/electron/mcp-server.ts` → 已鉴权的 127.0.0.1 动态端口 TCP → `apps/desktop/electron/mcp-bridge.ts::installMCPBridge` → 窄 Electron IPC → `src/mcp/renderer-host.ts::attachMCPHost` → 同一个 EditorStore 上的 `EditorOperations`。

内部 TCP 是私有有限消息封装，不自称另一套 MCP 协议。不提供 HTTP、浏览器来源、CORS、远程监听、任意本机文件读取或通用 IPC Gateway。Renderer 内存通过真实 IPC 操作，绝不是 stdio 进程直接访问。

`src/main.tsx` 只为真实桌面 Store 挂载一次 host。`src/desktop/editor-operation-schemas.ts` 从 P5 原位提取相同输入 Schema，P5 和协议映射共用同一对象。`src/mcp/contract.ts::toolSchemas` 是七项协议名称的有限映射，不是新的编辑动作 Registry。

| MCP 工具 | 实际原生入口 | 权限 |
|---|---|---|
| sf_project_info | EditorOperations.getProjectInfo | 读取 |
| sf_scene_tree | getSceneTree，原 CommandSystem.getSnapshot | 读取 |
| sf_inspect_layer | getLayerDetails / layerProperties | 读取 |
| sf_selection | getSelection，原 EditorStore 快照 | 读取 |
| sf_set_property | setLayerProperty → editPropertyCommand → EditorStore.run | 编辑 |
| sf_import_layer_package | importLayerPackage → importLayerPack → 原 Layer Package Reader / Transaction | 导入资产 + 明确选定的目录 |
| sf_render_frame | renderFrame → OutputFrameRenderer.init/draw/dispose | 读取 |

没有 run_script/eval/execute_js/shell/delete_project、原始 Command、保存到任意路径、raw NativeServices.dispatch 或 grantRead 工具。保存继续由 GUI 原 ProjectService 执行。查询只投影原生快照，客户端收到的是数据副本，不是服务端维护的第二棵 Scene。

## 契约

请求字段与限制完整沿用 SF_EDITOR_OPERATIONS_CONTRACT.md。先调用 sf_project_info 取 `{projectId,revision}`；写操作再明确 `requestId` UUID、layerId、原生 property/value/time，或者 compositionId/directory。不得以当前选区推测目标。

sf_set_property 仅接受原生 layerProperties 实际列出的动画属性路径，非任意 JSON patch。不增加创建/删除、静态文本/名称修改等 P5 之外的权限。原生 Schema、锁定、事务和 20 MB 保存预检没有放宽。

结果为 MCP text block 内的原 `{ok,context,data}` 或 `{ok:false,error:CoreError}`；失败设置 isError。渲染另返回 image/png block，文字元数据不重复含 base64。取消信号来自 `ctx.mcpReq.signal`，映射到私有 cancel 消息和原 AbortSignal；被取消的 MCP 请求响应处理交给 SDK。

## 授权、隔离与生命周期

- 设置 → AI / MCP → MCP，主动启用；默认只读，可单独勾选编辑和导入。状态不写 Scene、不保存到配置，重启不恢复授权。
- 主进程随机生成 256-bit 临时 bearer token，UI 连接配置只在本次显示，不落盘、不入日志。通过 MCP 客户端环境变量传入 CLI，CLI 读取后从自己的 process.env 删除；不是命令行参数。
- 仅绑定 127.0.0.1；每次启用只允许一个鉴权连接，断开后 token 不可复用。重新启用生成新 token/端口；旧连接立即关闭。
- Renderer 同步撤销旧文档授权，随后主进程关连接；projectId、revision、原生导入的捕获快照再独立检查。关闭/同ID重载/切换工程、Renderer 导航、窗口退出均撤销。读也要求存在真实活动工程。
- 连接断开、单请求取消、禁用、工程改变均取消未提交任务。重复 requestId 沿用 P5 永久保留到 host 销毁的拒绝表；至多256次受理写入，满额需重启宿主，不自动换 token 重放。
- 导入只允许设置内由用户原生选定的那一个包目录；客户端传入任意其他路径直接拒绝。仍由原 FileGrants、P3 严格 manifest/PNG/路径检查和内嵌资产策略处理。
- 并发连接候选至多8个，未鉴权3秒断开；stdio/内部请求读缓冲最多1 MB；内部最多8项待完成，60秒取消超时；渲染仍为 P5 单任务、2–2048长边/原尺寸像素上限和返回大小限制。
- 同步事务已经提交时不会因后来断开而自动 Undo。结果丢失时属于 outcome unknown，客户端必须重新查询，不能静默重放。原 Undo 仍可撤回。

## UI 与交付

遵循 DESIGN.md 和 design-system 技能：Application/Project、Manage/Automate、F5、APPLICATION，canonical 复用 settings / menu.file，页内参数归现有设置窗口。FEATURE_INVENTORY.md / FEATURE_LOCATION_MATRIX.md 已登记，无新增常驻 toolbar / shell 按钮。真实设置显示连接、最近操作和失败原因；原状态栏显示 MCP 操作进展。内部 UX 检查覆盖状态可见、显式权限、可撤销授权、秘密提示、关闭/键盘和错误状态，不等同真人用户研究。

桌面构建输出 `desktop-dist/mcp-server.cjs` 并随原安装包进入 asar。UI 配置使用应用自己的可执行文件 + ELECTRON_RUN_AS_NODE，不要求用户安装系统 Node。两端候选安装包仍采用基线元数据1.0.3，独立输出，不覆盖原冻结包、不宣称正式发行；验证与限制见 docs/qa/mcp/installers.json。

## 使用方式

在已打开的工程中进入“文件 → 设置 · AI / MCP → MCP”，选择本次权限并启用。需要导入时，先选定授权分层包目录；客户端不能自行扩大目录授权。展开“客户端连接配置”，复制给可信 MCP Host；SF不自动写配置文件，Host自行保存的含密钥配置仍需用户保护。客户端先查询工程上下文，再带明确ID与revision调用工具。结束时关闭MCP并撤销授权；重启、换工程或连接断开后重新启用。Windows运行未实机验证。
