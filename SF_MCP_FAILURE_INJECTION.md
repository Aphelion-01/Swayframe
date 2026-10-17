# SF MCP 失败注入

最终自动化：docs/qa/mcp/final-e/report.json。每个拒绝都检查真实 Scene/Undo 或读取当前状态；实际错误保留在 report.failures。没有假响应替换 Scene、文件读取或 Renderer。

| 情况 | 实际结果 |
|---|---|
| 未启用 | 主进程没有 listener；status.enabled=false |
| 错 token | 私有连接关闭，UI记录“未经授权的连接已拒绝”，不消耗合法首次连接 |
| 只读客户端修改属性/导入 | PERMISSION_DENIED；完整 Scene 不变 |
| 无效 UUID 图层/已删除层 | INVALID_REFERENCE；不修改其他图层；过期版本优先 STALE_BASE |
| 非法 property / __proto__ | INVALID_ARGUMENTS；不当对象属性路径执行 |
| 工具未知/额外字段/非UUID目标 | 原严格 Schema 拒绝；单元覆盖七工具 allowlist，真实 Client 验证未知字段 isError |
| 未批准目录 /private/etc | PERMISSION_DENIED；不读取或自动授予权限 |
| 已授权 C-path 坏 manifest | 原 P3 Reader 拒绝包内逃逸，COMMAND_REJECTION；Scene/资产/历史不变 |
| 重复属性 requestId | REPLAY_FORBIDDEN；即使Undo/Redo后重新查询 revision，也不重复写 |
| 原导入 pending 时重复 requestId | 第二调用 REPLAY_FORBIDDEN，第一调用唯一成功；Undo仅一笔恢复原 Scene |
| 旧 revision | STALE_BASE；不自动刷新重放旧包 |
| 客户端取消后实际导入 IO 晚到 | SDK AbortSignal→内部 cancel→原 importer；释放真实 IO 返回后 Scene 不变 |
| 客户端断开后导入晚到 | 同上；不留部分资产，不新增 Undo |
| 断开后复用 token | 下一次实际工具调用被拒绝；静态协议 discovery 可以完成，但无法访问任何工程 |
| 导入中切换工程 | Renderer同步撤销授权，原 importer owner检查拒绝，桥关闭；新工程完整 Scene 不变 |
| 导入中关闭窗口 | 独立 Node 客户端观察真实退出，连接关闭、监听释放、保存文件不变；window-close/report.json |
| GUI 保存/关闭/重开 | 工程重开必须重新启用；正式 dist 新连接读取实际保存值，原生 GUI Undo仍生效 |

## 真实时序注入方法

测试在 NativeServices 原 `assets.layerpack` 已完成真实文件读取之后，暂缓它的**真实返回值**。随后执行 Client Abort/Client.close/实际 store.load，再释放原返回值。没有制造“取消成功”或“导入成功”的 Mock。取消、归属、单次提交继续由现有 P3/P5 产品代码执行。

Scene污染检查使用 store.save 完整序列化对比，不只比图层数。导入成功后立即Undo/Redo也比对原 Scene；保存调用原 NativeServices 写真实工程，并读取磁盘/重新打开。

## 已知边界与未覆盖

- 60秒操作超时、8个候选连接/8个pending、超长传输、Renderer崩溃/系统强杀主要由源码限制；本轮未逐项进行压力/系统故障实测，不能列为自动化 PASS。
- 已提交但响应丢失时不是回滚保证。必须查询实际状态；新连接不能用新requestId伪装“安全重试”旧意图。
- 本轮未自动复跑P3全部图片炸弹/符号链接样例，它们仍由原 Reader及既有单元/真实Electron证据承接。没有扩展包格式或降低资源限制。
- 未测 Windows 实机、磁盘满、多个 OS 用户互攻或所有第三方 Host。没有增加多Agent QA、大型 Motion Harness 或付费模型调用。

安全准入仅适用于默认关闭、单个显式授权本机客户端；不允许据本报告开放远程监听或任意命令。

最终源码复跑：final-e 14/14；final-production 8/8（正式dist + 最终Mac包内CLI）；window-close 独立Node进程5项检查通过；all-tests-final 903/903。两端各25个运行文件与最终构建逐字节一致，QA未打入包；DMG校验及Windows PE检查通过。两端未签名，Mac未公证，Windows运行未验证。
