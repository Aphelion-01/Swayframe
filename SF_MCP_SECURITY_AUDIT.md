# SF MCP Bridge V0 安全审计

结论：本轮有限本机授权模型可以进入显式启用测试，**默认继续关闭**。这不是跨用户、远程网络或任意本机恶意程序的全面安全认证。

## 边界与证据

| 判断 | 分类 | 实际证据 |
|---|---|---|
| MCP 默认不监听；仅主动 enable 时 listen(0,'127.0.0.1') | 已由源码及测试证实 | installMCPBridge；final-e default-off-and-unauthorized-client |
| 临时随机密钥、timingSafeEqual、单连接一次授权 | 已由源码及测试证实 | mcp-bridge.ts authenticate 分支；错 token 拒绝、断开后重用拒绝 |
| 只读不能写属性/导入，目录需独立用户选择 | 已由测试证实 | final-e read-only-permissions、explicit-import-permission-folder-and-bad-path |
| 外部没有任意 Scene Command/文件写/JS/shell | 已由源码证实 | contract.toolName、mcp-server 七项注册；preload 仅窄 control/event/reply |
| Renderer IPC sender 与 senderFrame 限制 | 已由源码证实 | sf:mcp:control、sf:mcp:reply 均检查本窗口 mainFrame；外部无法调用原生 dispatch |
| 所有包参数来自不可信客户端，严格 Schema 在 SDK/main/P5 校验 | 已由测试证实 | malformed extra 字段、错误 UUID/属性、CoreError；tests/mcp-bridge.test.ts |
| 切工程同步关闭 Renderer 授权，原生 revision/target 再检查 | 已由源码及测试证实 | attachMCPHost、EditorOperations、P3 importer；final-e late import / project switch |
| Scene/Command/Renderer/Importer/Agent 源码未改 | 已由源码比对证实 | docs/qa/mcp/source-protection.json；共享 Schema 仅从 P5 模块抽出 |
| 图层名/文本只是数据，不进入系统指令或解释器 | 已由源码及单元测试证实 | 原生 layer read / 不支持任意属性 patch；没有 Agent Runtime 或代码执行工具 |
| 内嵌 PNG、事务、保存/Undo 复用 P3/P5 | 已由真实客户端测试证实 | final-e 与 production；原生导入/保存/重开、PNG 实际像素 |
| 已提交写入后断开是否可保证“没改动” | 无需伪造保证 | 不保证；结果可能丢失，保留 Scene 和 Undo，requestId 拒绝重放 |
| 第二套 Scene / Planner / 通用 Gateway | 无需新增 | 协议层只发送允许的消息，没有镜像工程或自动 Planner |

## 明确限制

- token 是本机 bearer credential。同一 OS 用户下能读客户端配置/环境、调试进程或操控 SF UI 的恶意程序可能窃取它；管理员/系统调试权限不在隔离承诺内。不得分享含 token 的配置。没有将“本机”误认为免鉴权。
- TCP 不使用 TLS，只在 loopback；不是可转发到局域网/公网的部署。没有开放 HTTP，因此不提供或依赖浏览器 Origin/CORS 作为认证。
- 限制连接候选/缓冲/并发，不能保证抗本机持续 DoS。持 token 的客户端拥有用户勾选的权限，不做每个写操作的重复确认；UI 明确显示授权及最近操作。
- 对正常文件符号链接/逃逸/坏包继续使用 P3 检查；恶意并发文件系统替换的全部时序、Windows ACL 和跨用户攻击缺乏本轮实测，不能标记通过。
- 运行期控制/结果消息只授予可信 Renderer；若 Renderer 本身已被攻陷，不应假装本桥建立了独立强隔离。
- 客户端取消与断开只阻止尚未提交的工作。已经同步提交的 Transaction 保留可撤销结果；不做暗中补偿 Undo，也不报告假 rollback。
- 当前错误仍复用原 CoreError。桥权限拒绝为 PERMISSION_DENIED；私有格式无效直接断开，不回显不可信内容。超时关闭尚未提交工作并显示“操作超时”，不自动重试。
- P5 host 的256次写请求账本不随重新启用清空，以免通过重连绕过去重；达到上限需重启应用。不是跨重启永久 exactly-once。

## 依赖审计

npm audit 记录于 docs/qa/mcp/dependency-audit.json：8 moderate、1 high，路径属于既有 electron-builder / Electron 下载和打包工具链（http-cache-semantics 等），未报告新增 MCP SDK 漏洞。本轮没有执行 audit fix --force 或扩展为打包工具升级。不能据此宣称全部依赖无漏洞；包构建时使用本地 Electron 缓存。

## 未验证

Windows 实机、本机恶意进程压力测试、第三方所有 MCP Host、远程/多用户部署、用户自己把连接配置外发后的安全性。本轮无付费模型调用。官方协议与 SDK 来源见 SF_MCP_ARCHITECTURE.md。
