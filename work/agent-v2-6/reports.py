import json
from pathlib import Path
from collections import Counter
root=Path('.')
out=root/'outputs/agent-v2-6'
if (out/'live/calls.json').exists():
 raise RuntimeError('This generator is OFFLINE ONLY; never overwrite live evidence or status.')
f=json.loads((out/'fault-offline.json').read_text())['rows']
l=json.loads((out/'long-horizon-offline.json').read_text())['rows']
e=json.loads((out/'electron-offline/report.json').read_text())
t=json.loads((out/'quality/phase4/tests.json').read_text())
summary={
 'version':'1.0.2','defaultRuntime':'legacy-v1','paidRequests':0,
 'liveRecovery':'NOT VERIFIED','canary':'NOT READY','replacement':'NOT READY',
 'unitTests':{'passed':t['numPassedTests'],'total':t['numTotalTests']},
 'faultRecords':len(f),
 'longHorizon':{'fixedTaskRepetitions':len(l),'actionsPerTask':[16,12,12],
   'allCompleted':all(r['phase']=='COMPLETED' for r in l),
   'faultEvents':sum(len(r['faults']) for r in l),'deterministicSuccesses':sum(r['deterministicRecoveries'] for r in l),
   'fixtureModelSuccesses':sum(r['fixtureModelRepairs'] for r in l),'unexpectedMutations':sum(r['unexpectedMutations'] for r in l)},
 'electron':{'cases':len(e['rows']),'passed':sum(r['pass'] for r in e['rows']),'frames':sum(len(r['frames']) for r in e['rows'])},
 'offlineRecovery':{
   'deterministicAttempts':sum(r['state']['deterministicRecoveries'] for r in f)+sum(r['deterministicRecoveries'] for r in l)+sum(r['deterministicRecoveries'] for r in e['rows']),
   'deterministicSuccesses':sum(x['outcome']=='SUCCEEDED' and x['method']!='MODEL_ARGUMENTS' for r in f for x in r['state']['recoveries'])+sum(r['deterministicRecoveries'] for r in l)+sum(r['deterministicRecoveries'] for r in e['rows']),
   'fixtureModelAttempts':sum(r['state']['recoveryAttempts'] for r in f)+sum(r['fixtureModelRepairs'] for r in l)+sum(r['fixtureOrLiveModelRepairs'] for r in e['rows']),
   'fixtureModelSuccesses':sum(x['outcome']=='SUCCEEDED' and x['method']=='MODEL_ARGUMENTS' for r in f for x in r['state']['recoveries'])+sum(r['fixtureModelRepairs'] for r in l)+sum(r['fixtureOrLiveModelRepairs'] for r in e['rows']),
   'liveModelAttempts':0,'liveModelSuccesses':0,
   'explicitProviderRetryFixtures':sum(r['state']['providerRetries'] for r in f)
 },
 'limits':'Offline fixtures and repeated fixed tasks are not independent model samples or a population recovery success rate.'
}
(out/'offline-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
cases=[('L1-V2',3),('L2-V2',3),('L3-V2',3),('R-A-V2-L1',1),('R-B-V2-L1',3),('L1-V1-matched',3),('L2-V1-matched',3)]
budget={'stage':'V2-6','authorized':False,'requests':20,'inputTokens':400000,'outputTokens':40000,
  'maxOutputPerRequest':2000,'plannedCases':[{'id':id,'maxRequests':n} for id,n in cases],
  'plannedCaseRequestSum':sum(n for _,n in cases),'provider':'existing DeepSeek','model':'deepseek-flash',
  'sendImages':False,'sendPrivateProjects':False,'unknownUsage':'reserve UTF8 body bytes + 5000 input and 2000 output',
  'costRisk':'Token request caps are not a fixed monetary guarantee; billed cost follows the actual provider account and cache hit tariff.',
  'status':'AWAITING NEW HUMAN AUTHORIZATION; V2-5 authorization does not apply'}
(out/'live-budget.json').write_text(json.dumps(budget,ensure_ascii=False,indent=2)+'\n')

def write(name,body):
 (root/name).write_text(body.strip()+'\n')

write('AGENT_V2_RECOVERY_ARCHITECTURE.md','''# Agent Core V2-6 Recovery Architecture — 1.0.2

本轮基线为 801008a / 1.0.1，独立分支 `codex/agent-v2-recovery-1.0.2`。普通工程仍默认 Legacy V1。没有新建 Runtime、Planner、Recovery Manager、Capability Registry、Scene 或渲染算法。

## 状态与执行路径

既有 TaskRuntime 唯一持有 TaskState、step 状态和真实 result 引用。路径仍是 ProviderBridge → AgentPlanner → TaskRuntime → EditorAdapter → 实际 Tool Registry → AgentTransaction / CommandSystem → step/final Verification → Renderer → Proposal → 用户接受。Intelligence 无 Scene 写入或提交端口。

每步记录 action、实际 Registry resolvedArguments、attempts、recoveryAttempts、draftVersion、failure 和真实输出 layerId/effectId/keyframeId；状态为 PENDING/READY/RUNNING/RECOVERING/SUCCEEDED/FAILED/CANCELLED。Task 的 completedActions、pendingActions、references 与 Scene hash 在每步更新，读取目标使用当前真实草稿，不靠名称猜测。依赖解析和稳定拓扑排序保留。

## 重放安全

执行前同时记录 Scene hash 与 Transaction evidence。捕获失败后，必须确认事务未关闭且两个证据均未改变，才允许局部恢复。写入已发生或写入结果不确定时终止为 REPLAY_FORBIDDEN / UNSAFE；createShape、addEffect、addKeyframe 不会盲重试。完成的步骤及真实 IDs 保留，不重新生成计划，不重放成功前缀。

该策略是拒绝不确定重放，并非跨进程 exactly-once 协议。应用重启、进程崩溃后的持久续跑、远程幂等键和任意外部副作用未实现。不能宣称永远不可能重复对象。

## 恢复策略

| 情况 | 策略 | LLM |
| --- | --- | --- |
| typed CONTEXT_STALE，草稿写前证据一致 | 重读当前草稿并重新 prepare 失败动作 | 不调用 |
| typed recoverable INVALID_REFERENCE，既有 resultMap 有唯一真实 ID | 重新解析已验证的结果 ID，不改目标语义 | 不调用 |
| typed recoverable COMMAND_REJECTION，明确写前拒绝 | 同一失败动作重试 | 不调用 |
| 实际参数 Schema 失败，目标/能力仍合法 | 仅请求失败动作的参数修复，重新 dry validate | 至多 2 次 |
| network/timeout/429/5xx | 显式启用后可有限重试，遵守 Retry-After | 产品默认 0 次自动重试 |
| 目标不存在/选择不唯一、权限、能力缺失、依赖错误 | 停止并诊断 | 不瞎猜 |
| 写后不确定、正式基线变化、错误计划/不可解析响应、取消、预算耗尽 | 停止，禁用提交 | 不继续 |

模型修复输入只有失败类型 Schema、失败动作、结构化诊断及 goal/draftVersion/completedActions/真实 target 的有界摘要；不发送整 Scene、全工具 Schema 或完整历史。候选不能更换 action ID/type/target/dependencies/property/keyframe/content/shape。相同的规范化非法候选不循环请求，实际 Tool Registry 是参数权威。

## 事务与预算

失败/取消关闭草稿事务。写前安全失败前缀标为 INSPECTABLE，只读检查不能接受；写后污染标为 UNSAFE；取消为 DISCARDED。用户修改正式基线后草稿停止，正式新修改保留。成功由显式接受提交一次共享 Transaction、一次 Undo。

默认每任务：100 actions、2 deterministic recoveries、2 model repairs、3 total model requests、0 Provider retries、180s、300000 input / 40000 output tokens。Planner 和 Repair 显式 maxOutputTokens=2000，真实 HTTP 转成 max_tokens。调用前按 UTF8 JSON bytes + 5000 预留输入，未知用量保留预留，收到用量后核算；预留超限不发送。输出/输入实际用量超限停止后续操作。估算和账户收费不同，不能据此保证固定美元费用。

Runtime 取消/超时抢占等待，即使外部 repair promise 不响应 signal，晚返回也无写入端口。真实产品传输沿用原 ProviderManager/NativeAIService 的取消与计费机制，没有暗中 Failover、协议切换或不可见重试。

## 可观测性与边界

现有隔离 Lab 显示阶段、已完成步数、恢复完成数；成功恢复不再显示历史错误警报。失败保留输入，可查看未完成草稿但不可接受。脱敏导出仅允许明确字段：版本、阶段、真实 IDs、失败 code/field、恢复方法/结果、预算、请求预留/实际 usage、Renderer metadata；不导出文本、参数值、原始模型响应、Scene、图片、Key。

setFontSize 复用既有工具与 Command，让 V2 小范围子集为 10 WRITE 工具。未开放 Skill/Forge/视觉重建、非零 Blur Radius 编辑、任意 Graph/3D。离线已验证；LIVE RECOVERY NOT VERIFIED，正式 Canary / V1 replacement NOT READY。
''')

rows=[]
expected={
 'R1':'实际 Registry 拒绝颜色参数；fixture 修复失败动作，成功前缀保持，单次提交/Undo/Redo',
 'R2':'注入可恢复引用缺失；唯一 result ID 重解析，不调用模型；不是任意已删除目标复活',
 'R3':'明确写前拒绝 addEffect；确定性重试，无重复 shape/effect',
 'R4':'后期 stale 草稿上下文；重新读取，前面完成步骤不重放',
 'R5':'非法 opacity 与相同非法修复返回；Schema 拒绝后停止，只有一次修复请求',
 'R6':'模型修复等待中取消；无视 signal 的晚响应也不写正式 Scene',
 'R7':'等待中通过正式 Command 改用户工程；草稿停止且不覆盖用户新状态',
 'R8':'实际可见 capability 被撤销；停止，明确不可用，无虚构工具'}
for r in f:
 if r['id'] in expected:
  s=r['state'];rows.append(f"| {r['id']} | {expected[r['id']]} | {s['phase']} | {s['deterministicRecoveries']} / {s['recoveryAttempts']} |")
write('AGENT_V2_FAULT_INJECTION_REPORT.md','''# V2-6 Fault Injection — OFFLINE VERIFIED

26 个故障/安全测试，27 条结果记录；fixture 定义只被 tests/work 引用，产品不加载故障注入器。Registry 参数/真实 Commands/AgentTransaction/TaskRuntime 均使用生产实现，没有替换为模拟 Scene 写入。

| 案例 | 真实触发与断言 | 最终状态 | 确定性 / fixture 模型修复尝试 |
| --- | --- | --- | --- |
'''+ '\n'.join(rows)+'''

其他边界：实际写入后再报错的 createShape / addEffect / addKeyframe 三例均 UNSAFE 并停止，不重试；非法修复后第二次合法候选能继续；修复更换目标拒绝；零修复预算不请求；180s 上限及短 deadline 注入能停止未响应 promise；稳定拓扑排序；network/timeout/429/503 仅在测试明确开启时各有限重试一次；401/invalid JSON/partial/unsupported 直接停止；Retry-After 超剩余时间不等待；输入/输出预留超限在传输前阻止。

故障测试组确定性恢复 3 次成功；fixture 模型修复 8 次尝试、2 次成功，其余包含有意构造的非法参数、取消、基线变化、改目标与超时停止。Provider 显式重试 fixture 4 次另计。这不是自然语言用户任务恢复率；受控 terminal 测试通过意味着安全停止，并不意味着任务完成。

机器证据：`outputs/agent-v2-6/fault-offline.json`。初次失败及修复日志保存在 quality/phase1-initial、phase2-initial、phase2-recheck；包含规范化候选循环缺陷及正式基线测试 fixture 调用修正，不隐藏初次失败。最终 Phase 2～4 均通过。本轮付费请求 0；LIVE RECOVERY NOT VERIFIED。
''')
write('AGENT_V2_LONG_HORIZON_TEST.md','''# V2-6 Long-Horizon Execution

## 固定任务与独立断言

| Task | Actions | 场景 |
| --- | --- | --- |
| L1 | 16 | 三对象创建/命名/颜色/位置，后续文字字号96，再修改已有对象与关键帧 |
| L2 | 12 | 两种对象径向渐变的中心/半径/起止颜色、文字后续字号80及颜色、opacity 中间帧、后期位置修改 |
| L3 | 12 | 创建模糊实例、文字后续字号90/颜色、位置关键帧及中间帧、后期填充修改；不宣称非零模糊视觉质量 |

每任务重复 20 次：7 clean、7 后期 stale 确定性恢复、6 后期参数失败 fixture 修复。合计 60 次固定离线重复，39 次实际故障触发（21 确定性、18 fixture 模型修复）。全部完成，正式受保护对象意外修改 0。**不是 60 个独立 LLM 样本。**

执行前检查最新 Scene hash 与 TaskState sceneVersion、resultMap 与已成功动作输出一致。目标 READ 与 WRITE 合计每任务超过5次（多数10次以上），每步参数从当前 Registry resolve；创建/效果/关键帧成功动作 attempts=1。对最终位置、RGB/渐变起止色、文字内容/字号、效果数量、关键帧与动画中间帧另作独立断言，不仅检查退出码。一次 Commit、Undo/Redo 和工程保存重载逐次验证。

## 实际 Renderer

独立 Electron 执行 7 场：三个 V2 长任务、两个 V2 故障长任务、两个实际 Native V1 的 matched subset。7/7 通过；每场0/1/2秒三个实际 PNG，合计21帧；全部有前景像素、目标参数通过、一次提交、Undo/Redo、save/load、保护对象完整。故障确实触发后才计 recovery。

L1 V1 fixture 的15步与 V2的16步差异是已有 linear interpolation 在 V1 fixture 中无需重复 modifyKeyframe；两者独立 goal 断言相同。它不能用来比较模型效率。图片人工检查了 L1/L2/L3 的1秒帧；这是工程与像素输出验证，不是艺术质量评分。

证据：`long-horizon-offline.json`；`electron-offline/report.json`；逐场 `*-trace.json`、`.swayframe`、PNG。本轮真实自然语言长任务尚未测试：LIVE LONG-HORIZON NOT VERIFIED。
''')
recover=summary['offlineRecovery']
write('AGENT_V2_RECOVERY_BENCHMARK.md',f'''# V2-6 Recovery Benchmark

## 当前可确认结果

| 样本组 | 确定性尝试/成功 | fixture 模型尝试/成功 | 真实付费模型恢复 |
| --- | --- | --- | --- |
| 故障记录组 | 3/3 | 8/2 | 0 |
| 60次固定长任务 | 21/21 | 18/18 | 0 |
| 7场实际Electron集成 | 1/1 | 1/1 | 0 |
| 合计 | {recover['deterministicAttempts']}/{recover['deterministicSuccesses']} | {recover['fixtureModelAttempts']}/{recover['fixtureModelSuccesses']} | 0 |

合计为跨不同测试组的实际恢复计数，不能视为独立统计样本。fixture 失败包括刻意要求停止的边界，不能用 21/27 作为一般用户任务成功率；25/25 也不能外推“任意错误100%恢复”。Provider 4次显式重试另计。Type A确定性恢复与 Type B参数模型修复严格分开。

## 公平对照

离线实际 Native V1 和实际 V2 使用相同合成、受保护对象、目标、Provider fixture、10 WRITE + READ 的可见/可执行目录、授权范围和每任务最多3请求。均关闭 Skill、视觉、隐式 Failover。完整 V1 产品 UX 未测试，禁止把这个受限执行子集说成完整产品对照。

V2-5 历史原始16付费调用及 permission-catalog 补测证据保持原文件原hash；其初次 V1 未匹配可见目录，不能混进本轮 matched 对照，也不能据此声称 V2 优于V1。

## 待授权 Smoke

3个 V2长任务 + Type A写前 stale + Type B真实失败动作参数修复 + L1/L2 matched Native V1，共7场、最多19请求，预留总授权上限20。V1/V2同 DeepSeek/model/tools mode、同10工具权限、同初始合成及同goal；每任务最多3请求、每请求输出2000。Type A独立最多1请求且模型修复预算0。

模型原始计划/修复响应、故障真实触发、成功前缀、真实输出ID、Scene、Renderer、Commit/Undo/Redo、保存重载及全部调用账本均保留。未知用量不记0。若独立goal验证失败，即使 Schema/执行通过，也记任务失败。未触发故障不得计恢复成功。新增付费授权未获得，LIVE VALIDATION PENDING。

即便7场全部通过，仍是小规模Smoke，不足以替代较大重复样本/真实用户 Canary、完整V1体验和迁移回退验证。
''')
write('AGENT_V2_COST_ANALYSIS.md','''# V2-6 Cost & Authorization

本轮实际付费 API 请求：**0**。所有当前恢复请求来自明确标识的离线 fixture。V2-5 历史授权不沿用。

## 减少重复

成功前缀不重放；确定性恢复不调用模型；LLM只处理失败动作及对应Schema；相同非法候选停止；默认 Provider retry=0；每任务最多3真实请求、最多2参数修复；取消、deadline、stale base 和写后不确定直接停止。计划失败不会无条件重新规划。

## 本轮新增预算待批准

| Case | 请求上限（含规划/恢复/重试） |
| --- | --- |
| L1-V2 | 3 |
| L2-V2 | 3 |
| L3-V2 | 3 |
| R-A-V2-L1 | 1 |
| R-B-V2-L1 | 3 |
| L1-V1-matched | 3 |
| L2-V1-matched | 3 |
| 计划合计 | 19 |
| 本轮全局授权上限 | 20 |

全局累计输入最多400000 tokens、输出最多40000 tokens；每请求明确 max_tokens=2000。固定使用既有 DeepSeek / deepseek-flash，tools mode，不换收费Provider。不发送任何图片或真实用户私人工程，只发送独立合成测试数据。

每请求发送前保存账本并检查次数/剩余预留；输入按 UTF8 request bytes +5000保守估算，输出按2000；已知用量替换预留，未知用量保留预留而非0。全局20 requests中剩余1不能自动扩张测试计划；任何新测试/预算变更仍需授权。已有 live 账本不能覆写或静默重跑。

费用风险：Token/请求限制并不是固定金额承诺；实际收费取决于账户、模型、缓存命中和供应商当时费率。输入预留是保守估算，真实响应用量若超估计应立刻停后续请求并如实报告。取消或网络失败可能已产生费用；未知结果仍占预留。API Key/Authorization headers 不保存于报告、Trace或日志。

预算机器文件：`outputs/agent-v2-6/live-budget.json`。本轮提示词第十九节明确要求离线验收后等待新增授权，当前授权状态 PENDING。
''')
write('AGENT_V2_CANARY_READINESS.md','''# V2-6 Canary Readiness — NOT READY

| Gate | 状态 | 证据或限制 |
| --- | --- | --- |
| 原架构/默认V1/隔离工程 | PASS | 实际源码、Lab测试、原工作区保护复核 |
| R1～R8与写后重放/取消/基线/预算 | OFFLINE PASS | 26测试/27记录，非live模型 |
| 三类长链、引用、草稿与状态一致性 | OFFLINE PASS | 60次固定重复；不是独立LLM任务 |
| Renderer/Commit/Undo/Redo/save-load | PASS in offline Electron | 7场21帧；非生产迁移 |
| 启用/恢复提示/保留输入/检查失败前缀 | PASS | UI测试与4尺寸实际窗口 |
| Phase0～4质量 | PASS | 最终779/779；各Phase完整门禁日志 |
| 真实Type A/Type B/长任务 | NOT VERIFIED | 本轮新付费授权待批准 |
| 足量、公平重复样本 | NOT VERIFIED | 拟7场Smoke不等于100+样本 |
| 完整V1产品UX对照 | NOT VERIFIED | 当前仅10工具matched subset |
| 正式工程受控Canary、迁移/回退与重启续跑 | NOT VERIFIED | 没有对生产工程开启V2 |
| Windows运行与签名 | NOT VERIFIED | 仅构建；无Windows实机认证 |

**不能将V2设为正式默认，也不能宣称完成V1替换。** 只保留明确启用的开发者隔离测试入口。下一步是本轮授权后小规模真实恢复/长任务Smoke，保留失败与账本；之后根据数据设计独立重复样本和用户可回退的Canary方案，再单独获得正式Canary授权。本轮不连接Skill/Forge/参考图/高级Graph/3D。
''')
write('AGENT_V2_6_IMPLEMENTATION_RESULT.md',f'''# Agent Core V2-6 Implementation Result — Swayframe 1.0.2

结论：Phase0～4离线部分完成，质量门禁通过。Phase5真实付费验证等待本轮新授权；Phase6评估为NOT READY。没有正式切换默认Agent。独立开发分支 `codex/agent-v2-recovery-1.0.2`，基线801008a，历史1.0.1和原用户未提交修改保留。

## 16项必答

1. 支持真实参数Schema失败、有限typed引用/草稿stale/写前拒绝、Provider错误分类、预算/取消/基线冲突/写后不确定停止，详见 Recovery Architecture。
2. 确定性：重读当前草稿、唯一已验证result ID重解析、明确写前可恢复拒绝。无实际ID或不存在目标不能猜测修复。
3. LLM：仅失败动作参数，实际Registry复验；局部有界摘要、不重建计划。
4. 必须停止：权限/能力/依赖、丢失目标、正式base变化、写后不确定、取消/超时/超预算、不可解析Provider响应、违规改目标和重复非法候选。
5. 已完成steps/resultMap/currentdraft保留，不重放成功前缀；失败可安全只读检查，不允许部分草稿冒充完成。
6. 当前同一Runtime内有重放护栏，三类非幂等写后故障均停止；未实现跨重启exactly-once，不能保证所有未来情况绝无重复。
7. 60次固定长链及7场Renderer中真实对象引用稳定；按已完成输出ID绑定，不用名称。
8. 本轮这些离线样本未发现状态失同步；不外推到任意用户长任务。
9. 共 {recover['deterministicAttempts']} 次确定性恢复尝试 + {recover['fixtureModelAttempts']} 次fixture模型参数修复尝试，另4次显式Provider重试fixture；统计组之间非独立自然任务。
10. 确定性恢复成功 {recover['deterministicSuccesses']} 次。
11. fixture模型修复成功 {recover['fixtureModelSuccesses']} 次；真实模型参与恢复0次，LIVE RECOVERY NOT VERIFIED。
12. 失败路径无正式Commit，正常成功接受一次共享Transaction；用户base变化保留新修改，隔离Lab不接收原用户EditorStore。
13. 去除相同非法候选循环和整计划/成功前缀重放，缩小修复Schema/上下文；未知计费不记0。实际live成本优化尚未验证。
14. 本轮真实API请求0；V2-5历史16请求不算新增本轮结果。
15. 正式Canary条件不足：缺本轮真实恢复、长任务、公平重复样本和受控用户验证，NOT READY。
16. 正式替换V1条件不足，默认仍V1。

## 实际验证

- Phase0/1/2/3/4分别完成 typecheck、lint、tests、build、desktop build，最终 {t['numPassedTests']}/{t['numTotalTests']} tests。历史初次失败日志保留并修复后重新通过。
- 26个故障边界测试、27记录；R1～R8全部真实触发预定安全结果。
- 3个16/12/12动作固定任务各20次，合计60离线重复；39故障触发，0意外正式修改。
- 7场实际Native V1/V2 Electron / 21 PNG，独立goal、保护对象、一次Commit、Undo/Redo、save/load全部通过。
- 按 DESIGN.md 的现有 ASSISTANT入口、颜色/密度/滚动规则调整隔离Lab；4尺寸与失败前缀真实窗口通过。没有新增永久工具栏按钮或功能域。

所有证据在 `outputs/agent-v2-6/`，包含 offline-summary、fault/long records、Electron trace/Scene/PNG、各Phase质量及UI。七报告拆分记录架构、故障、长链、对照、成本、Canary及总结果。

安装包/保护复核与本分支提交信息在交付收尾后补入 `outputs/agent-v2-6/RELEASE_MANIFEST.json`；Mac实测范围与Windows未实机验证必须分开。当前本轮付费验证等待附件第十九节规定的新授权，预算20 requests /400000 input/40000 output，仅合成数据、无图片。
''')
p=root/'docs/DEVELOPMENT_LOG.md';p.write_text(p.read_text()+'''\n\n## 2026-10-12 · 1.0.2 / Agent Core V2-6\n\n在独立分支沿用 V2-5架构完成Phase0～4：写前/写后事务证据、确定性局部恢复、失败动作参数修复、规范化重复候选停止、取消/deadline/请求/Token预留、真实ID与长链状态观测。保留V1默认及开发者隔离入口，UI只读失败前缀/恢复进度/脱敏导出。最终779测试通过，60固定长链及7场真实Renderer验证；付费0，本轮live等待新增授权，Canary和V1替换NOT READY。初次失败及修复日志保留，七根报告和outputs/agent-v2-6记录边界。\n''')
print(json.dumps(summary,ensure_ascii=False,indent=2))
