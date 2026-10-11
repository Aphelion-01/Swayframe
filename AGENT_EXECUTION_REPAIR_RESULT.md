# Swayframe 0.9.27 — Agent Execution Core Recovery

**结论：CORE EXECUTION RECOVERY PASSED。** 本结论仅覆盖 AGENT-001～006 的执行核心，不能作为复杂参考图复刻质量、其他 Provider 或全部 Agent 功能可靠性的证明。

## 1. 基线、隔离与修改范围

业务基线为 0.9.26，快照 `bd2d82ca11db0f3327ad1d77cd16d7c21bcc4eb7`；以包含四份审计报告及原始证据的 `ce1ef68451fe4e9934d5435bbd30d941f05ced8a` 建立独立工作区。修复分支 `codex/agent-execution-recovery-0.9.27`。开始状态保存在工作区外 `Swayframe_Repairs/0.9.27-start-state.json`。核对基线源码后实施，未清理、提交或覆盖用户原工作区。

最终检查原工作区 HEAD、分支、index、未提交状态均与备份相同，1688 个源文件哈希全部相同；审计工作区 HEAD 和未提交状态也保持不变。详见 `outputs/agent-execution-027/final-verification.json`。测试产生的 `outputs/timeline-ux/performance.json` 只留在修复工作区，未作为业务变更提交。

没有新 Tool、Agent UI、Renderer、Scene Model、视觉规划器、Forge 能力或程序化执行指令。Project 格式未改变；应用版本、桌面产品版本变为 0.9.27。

## 2. Issue 对照：BEFORE / AFTER / TEST EVIDENCE

| Issue | BEFORE：快照事实 | AFTER：当前实现 | 对照证据 |
| --- | --- | --- | --- |
| AGENT-001 | `validatePlan` 遇 READ/effect_ 中断后续语义预演；READ→负 radius 或 camera fill 被接受 | 所有步骤先进行契约/工具/依赖检查；独立 CommandSystem 预演确定性写入；READ 和真实 Forge 产物明确 DEFERRED，后续确定操作继续验证；执行时对实际最新 Draft 再编译和检查范围 | 原 `local-probes.json`、`boundary-probe.json`；BEFORE 独立回归第4/5项失败，AFTER通过；新增 create→READ→write、Forge 未执行/未伪造产物断言 |
| AGENT-002 | 执行时 setFill 参数错，模型调用1次后终止，没有执行恢复 | 总恢复预算2，局部同 step/tool 修参；保留同一 Draft，不重放已执行创建；非可恢复错误、取消、越权、预算、重复参数或基线变化立即停止 | 原 `local-probes.json:boundaries.executionRecovery`；TEST-C/D/H/I；两次真实 DeepSeek 局部纠错成功，2对象、1Commit、Undo恢复 |
| AGENT-003 | `radialParameters` 广泛 record；负值/未知键/不支持 Fill 的目标未被正确提前限制 | 从正式 radialGradient ParameterDefinition 派生 strict schema、JSON声明、范围和选项，继续复用 parameterError；目标不兼容返回字段级语义错误 | BEFORE第1/2/3项失败，AFTER通过；原 `tool-contracts.json`；合法径向填充、三层真实 Canvas 与真实 DeepSeek PNG |
| AGENT-004 | 普通 compile Error 包装为 tool_failed，机器字段/阶段/恢复性丢失 | AgentExecutionError 八类代码与明确 phase；旧 AgentToolError 保留兼容，边界转换保留结构；setFill/目标、作用域、能力ID和实际命令/后验错误按源头分类 | 字段/脱敏/恢复策略测试；真实被拒 capabilityId 的日志保留；最终补丁测试缺能力分类，不再记为 COMMAND_FAILED |
| AGENT-005 | 对已序列化 JSON 截断：原审计1749→1600，无法解析 | 先限制数据深度/数组/字符串及敏感字段，再 JSON.stringify；必要时省略较大值但仍保留错误代码/阶段/字段，反馈始终完整 | 原 `boundary-probe.json` 与审计证据；1600字符反馈 JSON.parse 成功、凭据剔除、字段保留测试 |
| AGENT-006 | add→update 同 ID 同时要求旧/新值；合法连续操作误报 | 有 base 的生产路径使用同一正式 CommandSystem 按顺序归约完整最终 Project，再精确比较；两参数兼容入口按 ID/命令顺序归约；不关闭校验 | BEFORE第6/7项失败，AFTER通过；TEST-F/G，multiple updates、add/remove、create/delete及错误最终态拒绝 |

修复前结果 `before-regressions.json` 的7个断言全部失败；修复后同7个断言均通过，完整新文件现有25个断言。`after-regressions.json` 为最终代码同7项筛选复测（其余18项跳过）；中间阶段20项通过记录保存在 `intermediate-after-regressions.json`，最终25项及全量591项以 `release-tests.json` 为准。原始 createText 字段/类型错误是已有校验行为，未把它伪称为新确认缺陷；TEST-A继续覆盖字段反馈、改参后真实文字和字号改变。

BEFORE 的 keyframe 夹具最初误写 interpolation 为字符串，随后改为正式 `{type:'linear'}` 并在原快照源码重跑全部7项，记录为当前 BEFORE；未将夹具错误计作产品缺陷。

## 3. 实际文件与函数

| 文件 | 实际修改 |
| --- | --- |
| `src/agent/capability-schema.ts` | capabilityParametersSchema：ParameterDefinition→Zod/模型声明；复用原参数验证 |
| `src/agent/execution-error.ts` | AgentExecutionError、executionError、errorFeedback、boundedFeedback、argumentFingerprint |
| `src/agent/write-tools.ts` | registerCoreWriteTools 的 setFill 契约/目标编译；editableLayer 缺失目标诊断 |
| `src/agent/tool-registry.ts` | parsed、compile、read 错误传递；validatePlan/validateStages 分阶段预检；verifyResults 顺序最终态 |
| `src/agent/transaction.ts` | execute 捕获前态并校验最终态，命令失败/基线冲突类型化，原子提交仍用原命令 |
| `src/agent/orchestrator.ts` | plan 的完整反馈；execute/runSteps 有限局部恢复；fail 保留 executionError；Renderer错误分类 |
| `src/agent/creation-scope.ts` | validateCreationScope 越权明确 CONTEXT_INVALID、不可恢复 |
| `src/agent/creation-planner.ts` | resolveCreationDetails 将缺失能力与任务依赖/覆盖/策略错误类型化，校验规则未放宽 |
| `src/agent/effect-forge-tools.ts` | 仅 effect_inspect 缺失能力的错误协议，未增加 Forge 功能 |
| `src/agent/read-tools.ts` | 缺失图层错误字段/目标 |
| `src/agent/session.ts` | 可选 executionError/recoveries/recoveryContext，保留 Session/运行时状态于 Scene之外 |
| `src/ui/native-agent-controller.ts` | 既有 Runtime贡献 recoveryContext，使用最新 Draft 与已有预算；没有界面变更 |
| `tests/agent-execution-recovery.test.ts` | 25项回归/安全测试，未删除或放宽原566项 |

## 4. 验证与恢复边界

所有步骤执行 schema 与 Tool availability 检查；creation task 须恰好覆盖步骤且依赖顺序合法。预检不能执行异步 READ/Forge、不能臆造其产物。VERIFIED 表示当时可确定的契约及命令语义通过；DEFERRED 表示明确尚待实际 Draft/外部产物，不是已通过；拒绝错误携带 REJECTED 状态。

恢复依据 code + phase + recoverable，执行阶段不依靠中文 message 推断。只有在命令未写入前发现的可恢复 schema/语义/上下文问题进入局部修参；命令失败、后验失败、权限/基线冲突直接丢弃。请求复用 submitPlan 协议，但只允许一个原 tool/step；没有新的远程操作通道。每个候选都用最新 Draft 完整预检及原 scope。非上下文错误不能换 target，恢复不能引入 destructive 操作。参数指纹对键顺序归一化，重复无效值停止。已完成步骤保留，currentPlan显示实际修正后的参数。

没有重建和重放 Draft，因此不需要对已执行 create/add 的非幂等命令重试。正式工程只在结尾执行一次 Transaction；Undo/Redo 与原 CommandSystem 一致。用户编辑基线、取消或失败均不导致部分提交。

## 5. TEST-A～I 与分层回归

- A：首次文字参数类型/字号无效→字段反馈→新参数合法，实际文本/字号改变。
- B：相同无效参数重复，停止且正式工程不变。
- C：两对象已创建于 Draft→填充错误→只修参数，两个对象不重复，1Commit；含 READ→WRITE→READ→WRITE。
- D：恢复等待期间人类修改正式工程，保留新修改，Agent不提交。
- E：READ 后负参数/不兼容目标在预检或执行阶段边界被拒绝。
- F/G：关键帧连续 add/update/remove 和多次更新合法；伪造错误最终态明确拒绝。
- H：纠错等待时取消，没有后续写入或提交。
- I：不同无效修参消耗预算，明确停止，无部分正式提交。

这些自动化恢复模型是 scripted/mock；它们证明宿主控制逻辑，**不是 LIVE Provider验收**。

独立原生 Electron 验证10个操作：createText、setFill、createRectangle、setPosition、setScale、setRotation、addKeyframe、addEffect、createNode、connectNodes。Command层独立构造正式 Command/CompositingGraphService，未经过 Agent compile；Adapter层真实 AgentTransaction；Runtime层真实 Orchestrator（scripted plan）。三层使用未 mock 的 AgentSnapshotRenderer/Canvas，10/10 图像一致，真实 Scene改变、正式草稿隔离及Runtime Undo通过。证据 `local-render-report.json`、`local-*.png`。addEffect默认零模糊只证明插入/管线一致，另有真实Provider radius=10的非零效果PNG。

首次本地 Runtime测试脚本错误地传入另一个 host 的基线对象，真实基线保护正确拒绝；修正脚本使基线来自它自己的 host 后全部通过。初次输出保存在 `local-runtime-initial.json`，未放宽产品检查。

## 6. 质量门禁与兼容性

主要修复阶段的门禁日志全部保留；最终 `release-typecheck.log`、`release-lint.log`、`release-tests.log/json`、`release-build.log` 均退出0。145个测试文件、591个测试全部通过（原566 + 新25）。desktop:build含Web build与Electron主/预加载构建。原有大chunk/第三方PURE注释警告保留，不代表运行失败。

合法 setFill 名称/字段与旧工程不变；radius正式范围0.001～10，未知键只拒绝实际不支持参数；center不新增人为范围限制。动画仍使用 Property，效果仍使用 Graph/正式能力注册；共享Scope/基线/Undo与包精确版本哈希不放宽。没有修改Scene存储格式或真实渲染算法。

## 7. LIVE DeepSeek 设置、预算与证据

通过已授权的原生 NativeAIService 使用 `DeepSeek / deepseek-flash / https://api.deepseek.com`，与审计一致：stream=false、image=false、visualVerification=false、maxRefinements=0、autoApplySafe=false、failover=false。独立新工程、原生真实调用、没有用户图片/用户工程外发。设置覆盖仅在测试进程内，不覆盖用户设置；日志无 API Key。

三批预算分别24、16、8次，总最大48；**实际37次请求**（含专业分析内部请求），返回usage的35次记录合计 input **1,524,233**、output **25,776** Tokens。两次 malformed JSON 无usage，故这两个数是可观测下界，不伪造完整计费Token/费用。两个invalid_response均拒绝不完整数据后由既有完整响应恢复获得有效计划；未执行残缺JSON。真实日志 `live-calls.json`、`followup-calls.json`、`release-live-calls.json`；budget-round副本不是额外请求，统计去重。

首批5项基础任务全部完成：文字、纯色填充、原生径向渐变、位置关键帧、GaussianBlur(radius10)，及1次组合任务。随后组合2耗尽24次预算，组合3及受控纠错因同一预算安全停止；原始失败和工程保留，未删样或记为通过。补批2次组合与受控真实修参完成。最终错误分类补丁后再测1次组合与1次受控真实修参完成，并重新跑10项原生分层与完整质量门禁。

组合任务创建400×300矩形、原生渐变、可编辑文字、0秒/1秒线性位置关键帧；实际Scene、1秒Canvas、宿主保存/重开、单Commit与Undo/Redo核对。**保存由真实宿主工程IO执行，未伪造不存在的Agent文件工具。** 11张成功画布（9自主任务+2受控纠错）逐张独立检查，记录于 `visual-review.json`；精确属性以Scene断言为准，图像检查只判断基础可见目标，不能证明复杂视觉相似性。

受控执行故障：初始计划是scripted，前两步实际创建对象，第三步在写命令前人为注入明确参数错误；**局部纠错调用真实DeepSeek**。两次模型都把 radius0.5 改为0.8，同一目标，两个对象，1Commit，Undo恢复；不把注入故障称为模型自然产生的错误，亦不混入自主任务成功率。

## 8. 成功率（保留全部失败）

| 指标 | 成功 / 全部自主任务尝试 | 说明 |
| --- | --- | --- |
| Tool Call Validity（任务口径：无任何被拒activity） | 5/11 = 45.45% | 其余包含首次计划能力ID/依赖/参数或读取失败、预算停止；最终成功不抹去这些失败 |
| Execution Success | 9/11 = 81.82% | 2次预算停止未产生正式编辑 |
| Scene State Success | 9/11 = 81.82% | 实际最终属性断言通过 |
| Render Success | 9/11 = 81.82% | 成功目标在原生PNG可见；空失败工程PNG不计成功 |
| Full Task Success | 9/11 = 81.82% | 基础目标、真实Scene/PNG、宿主保存重开、一次提交、Undo/Redo；不含复杂复刻 |
| Recovery Success（受控执行故障全部尝试） | 2/3 = 66.67% | 1次因已耗尽网络测试预算未得到模型回复 |
| Recovery Success（实际得到模型纠错回复） | 2/2 = 100% | 条件子集，不能替代上面的原始比例 |

activity完成64/73 =87.67%，为已记录规划/读取/写入activity口径，不等于所有Provider内部proposal有效率或最终任务成功率。组合计划经历拒绝后完成4次；还存在1次预算停止。充分预算的已完成自主任务9/9只是条件子集，**原始9/11才是本轮总体任务尝试统计**。逐任务失败phase/code/recovery见 `metrics.json` 和原Session。

首批、补批是在核心实现通过后运行，最终补丁只补足creation/read错误分类；最终代码另做真实组合/纠错复测。不能声称所有37次请求都运行于完全相同文件哈希。

## 9. 未解决与明确边界

AGENT-007/008/009留给下一轮 Provider Diagnostics / Context Reduction / Streaming Recovery。当前全量能力上下文成本较高，专业分析产生额外请求；已观察两次Malformed JSON、缺失usage及诊断预算异常的phase分类不精确，不因此重写Provider或自动提高运行预算。部分其他旧编译器通用Error通过边界保守标为不可恢复，不猜测其可修复性。

本轮真实能力ID/元数据错误可反馈并有限重规划，但首次Tool Call Validity仍低，不能描述为模型零错误。测试范围没有覆盖复杂视觉复刻、多Provider生产体验、所有长时资产/跨合成并发；这些保持UNVERIFIED。旧Cubic失败不改写为成功。没有新Forge算法/图像生成/视觉规划/UI或Renderer。

Mac arm64 DMG与Windows x64 NSIS已按现有配置构建，均为未签名包；Windows由Mac交叉打包，未在Windows实机运行，不能称Windows运行验收通过。产物校验/哈希见 `installers.json`。未合并进用户工作区，以独立修复提交与安装包交付。

## 10. 最终验收

AGENT-001～006原边界、TEST-A～I、25项新回归、591项完整测试、10项真实原生分层、真实DeepSeek组合及局部恢复均形成可审查证据链。动态参数和目标提前识别，依赖明确阶段状态，后期可恢复错误有界修正，无重复创建、越权、部分提交或覆盖人类编辑；连续命令最终态正确且错误结果仍拒绝，单Commit/Undo/Redo成立。

**CORE EXECUTION RECOVERY PASSED**。复杂视觉规划与参考重建质量必须独立验收。
