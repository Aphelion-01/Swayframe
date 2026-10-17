# V2-6 Fault Injection — OFFLINE VERIFIED

26 个故障/安全测试，27 条结果记录；fixture 定义只被 tests/work 引用，产品不加载故障注入器。Registry 参数/真实 Commands/AgentTransaction/TaskRuntime 均使用生产实现，没有替换为模拟 Scene 写入。

| 案例 | 真实触发与断言 | 最终状态 | 确定性 / fixture 模型修复尝试 |
| --- | --- | --- | --- |
| R1 | 实际 Registry 拒绝颜色参数；fixture 修复失败动作，成功前缀保持，单次提交/Undo/Redo | COMPLETED | 0 / 1 |
| R2 | 注入可恢复引用缺失；唯一 result ID 重解析，不调用模型；不是任意已删除目标复活 | AWAITING_ACCEPTANCE | 1 / 0 |
| R3 | 明确写前拒绝 addEffect；确定性重试，无重复 shape/effect | COMPLETED | 1 / 0 |
| R4 | 后期 stale 草稿上下文；重新读取，前面完成步骤不重放 | AWAITING_ACCEPTANCE | 1 / 0 |
| R5 | 非法 opacity 与相同非法修复返回；Schema 拒绝后停止，只有一次修复请求 | FAILED | 0 / 1 |
| R6 | 模型修复等待中取消；无视 signal 的晚响应也不写正式 Scene | CANCELLED | 0 / 1 |
| R7 | 等待中通过正式 Command 改用户工程；草稿停止且不覆盖用户新状态 | FAILED | 0 / 1 |
| R8 | 实际可见 capability 被撤销；停止，明确不可用，无虚构工具 | FAILED | 0 / 0 |

其他边界：实际写入后再报错的 createShape / addEffect / addKeyframe 三例均 UNSAFE 并停止，不重试；非法修复后第二次合法候选能继续；修复更换目标拒绝；零修复预算不请求；180s 上限及短 deadline 注入能停止未响应 promise；稳定拓扑排序；network/timeout/429/503 仅在测试明确开启时各有限重试一次；401/invalid JSON/partial/unsupported 直接停止；Retry-After 超剩余时间不等待；输入/输出预留超限在传输前阻止。

故障测试组确定性恢复 3 次成功；fixture 模型修复 8 次尝试、2 次成功，其余包含有意构造的非法参数、取消、基线变化、改目标与超时停止。Provider 显式重试 fixture 4 次另计。这不是自然语言用户任务恢复率；受控 terminal 测试通过意味着安全停止，并不意味着任务完成。

机器证据：`outputs/agent-v2-6/fault-offline.json`。初次失败及修复日志保存在quality/phase1-initial、phase2-initial、phase2-recheck；不隐藏初次失败。Phase2～5均通过。本轮真实Smoke另有写前stale和真实Schema参数拒绝各1次触发、各1次恢复成功，完成前缀未重放；这是有限注入场景，不是自然故障总体恢复率。本轮11次付费请求包括所有成功/失败/复测，见独立live报告。新增两项提交标题边界回归，最终781测试通过。
