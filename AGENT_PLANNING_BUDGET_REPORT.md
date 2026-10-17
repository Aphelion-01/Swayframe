# Planning permission and budget — 0.10.1

## 根因及修复

旧实现将“工具没有声明 / 无 inspect”统一抛为“规划阶段工具调用越权或超过次数限制”；`round` 同时记录检查、格式纠错和恢复循环。调用次数、是否注册、是否声明和拒绝原因无法从旧文案确定。

新实现保持原限额：每会话最多 **12 次实际规划查询、3 轮查询响应**；生产默认共享 RecoveryController planningRequests=8、planModelRepairs=2、providerRetries=1，均未提高。`inspectionRounds` 只在处理 READ 响应后增加；格式纠错、计划 patch 不消耗查询轮次，但仍消耗原共享模型请求预算。达到查询上限或只剩最后规划请求时，只声明 submitPlan。第13次查询不执行，显式记录失败，再要求提交计划。达到上限后继续请求 READ，终止为 TOOL_BUDGET_EXCEEDED。

| 情况 | 诊断 | 行为 |
| --- | --- | --- |
| 注册 WRITE 在规划 function 层直接调用 | TOOL_NOT_ALLOWED / planning / orchestrator | 不执行，不提权 |
| 未注册工具 | TOOL_NOT_REGISTERED | 不执行，不凭名字注册 |
| 正常查询超上限 | TOOL_BUDGET_EXCEEDED | 拒绝超额查询，不无限重试 |
| READ 参数错误 | TOOL_ARGUMENT_INVALID | 记录具体 schema field / expected / received |
| Provider 明确返回 unsupported_tools / tool_calling_not_supported | PROVIDER_TOOL_UNSUPPORTED | 保留 provider 分类；没有从普通400或文本猜测 |
| Scene 工具参数错误 | 原始 SCHEMA_INVALID + TOOL_ARGUMENT_INVALID 恢复分类 | 只按正式 schema 修补失败步骤 |

每轮 Trace 保存声明、请求工具、已查询次数、轮次、限额、剩余模型请求、submitOnly 和拒绝原因；执行元数据另有真实 registeredTools / availableCapabilities。开发者导出的错误保留 module/capability/task/field、限长 expected/received。用户仍看到简短消息，无新增 UI。

真正 DeepSeek 请求 #5：getCanvasInfo 已注册 READ，却未声明；reads=1/12，inspectionRounds=0/3，code=TOOL_NOT_ALLOWED。修复 bootstrap 和目录表达后，请求 #9 的填充计划直接通过 submitPlan 完成，没有增加预算。固定响应重放也保留 getCanvasInfo 的这个具体回归。

## 外部测试预算

用户本轮授权12次（含重试）/200000输入/24000输出。最终**12 次、168794输入、5154输出 tokens**；usage 全部有记录，图片0。独立工程、独立用户目录；不改用户账号设置和正式工程。账本 `outputs/agent-stabilization/live-control/live-calls.json` 包含完整12次；中间账本是同一序列前缀，不能相加。

初版组合任务的下一请求被 UTF8+framing 输入上界在发送前阻止，并未计为 API 请求。此 guard 是验收 runner 的外部授权保护，不是生产 READ/WRITE 权限失败。减少基本任务无关 addKeyframe 和空合成的字体二次修改契约后，组合任务能够在剩余额度完成；没有修改保护阈值。预算已经用满，不再调用真实 API。
