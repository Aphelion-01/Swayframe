# Agent Core V2 测试矩阵

## 五组目标

| Benchmark | 实际验收 | 对照差异 |
|---|---|---|
| B1 | 新增三个矩形 RGB，第二个最终 Purple；真实引用；无多余图层；Undo | 相同最终动作与目标 |
| B2 | 原生 Cubic；serif、96、(960,450)、白色；实际 Renderer | 同一正式 createText |
| B3 | 原生径向渐变中心(.4,.6)、半径.7、两个合法五元组色标；像素 | 同一 setFill/渐变算法 |
| B4 | 位置0秒(400,540)、2秒(1500,540)，修改后的 Bezier，中点(950,540) | V1 固定计划在 Add Keyframe 提供最终 interpolation；V2 创建后使用 Modify Keyframe。最终状态相同；不能以动作数断言效率 |
| B5 | 创建矩形成功后，添加 Gaussian Blur 前注入一次可恢复错误；只失败步骤续跑；一个矩形/一个 Blur；一次 Undo | 两边相同任务、同样发生在写入前的故障。V1 拒绝相同参数恢复，安全退出；V2 续跑 |

每项每条路径 20 次，共 200 个固定响应任务。每个工程含一个原有受保护无关图层，检查其完整属性未变、更改图层数、单 commit、Undo/Redo、保存重载和真实 PNG。V1 使用未修改的 `createNativeAgent → AgentOrchestrator → AgentTransaction`；V2 使用新的 Planner/TaskRuntime。固定离线响应、同一 fixture 模型标识，外部 API 请求为零；不是付费 LLM 的重复独立样本。

## 回归边界

新增测试包含真实工具参数失败及 ProviderBridge 局部修复、Result UUID、选择歧义、错类型引用、授权范围、锁定目标、未知能力、不接受模型创建 UUID、默认参数、依赖循环/排序、一步式 Undo、重载、版本过期、错误接受令牌、取消规划/恢复、禁止重放、重复错误终止、模型/动作预算、Renderer 必需条件与错误分类、Provider 缺失/多个/WRITE 响应拒绝、明确 unsupported_tools、脱敏反馈及不可变状态。

离线 Fixture 不证明 Provider 支持 Function Calling；真实 Canvas PNG 不证明参考图复刻质量。真实模型任务可靠性、100 次真实样本的 95% 目标、Vision/高级 Graph/Skill/Forge 都仍为 LIVE NOT VERIFIED / 未接入。

## 证据

最终完整日志：`outputs/agent-v2/quality/`。最终对照：`outputs/agent-v2/benchmark/report.json`，首轮每组工程、PNG、trace 均保存。`benchmark-initial` 保存第一次测试端 Renderer 签名/V1 恢复回复格式错误；`benchmark-recovery-pass` 保存修正后的空工程对照。最终报告只使用 benchmark，未删除失败记录。

B5 保留正式 Gaussian Blur 默认 radius=0，验收其真实效果实例、恢复不重复与事务；该 PNG 不作为非零模糊质量证明。V2 本轮未开放效果半径编辑动作，参数可由现有 GUI 修改。

## V2-5 / 1.0.1 incremental regression

161 files / 747 tests PASS (prior735 retained, 12 new): explicit provider-mode precedence/accounting, one attempt/no hidden retry, pinned route, structured intent validity, live-style object output binding via actual Commands, accept/reject/Undo/Redo, diagnostic redaction, malformed model output rollback, developer flag/default Legacy V1, failed input preservation and isolated UI workflow. Electron native-path fixtureintegration V1 5/5 + V2 5/5 + structured V2 1/1; actual Renderer/goal/scope/persistence checked. UI four desktop sizes and Mac packaged flag/workflow open checks PASS. These earlier results are OFFLINE VERIFIED. On 2026-10-12, authorized live Smoke verified five V2 tools tasks plus one structured JSON-text task: 6/6, with actual Renderer/Undo/Redo. All runs including V1 used16 requests /165691 input /7275 output. Initial V1 catalog/execution mismatch is retained, D/E matched recheck2/2; no statistical superiority or95% reliability claim. Cancellation/error branches remain offline-only; expanded independent samples and formal user Canary remain NOT VERIFIED. See V2-5 root reports and outputs/agent-v2-5.
