# Agent Architecture Evolution — V0.1 至 0.9.26

审计日期：2026-10-11；业务基线：0.9.26，Git 快照 `bd2d82ca11db0f3327ad1d77cd16d7c21bcc4eb7`。
诊断分支：`codex/diagnose-0.9.26-20261011-124555`。原工作区、未提交修改和现有工程均保留。本轮未修改业务实现。
证据等级：CONFIRMED=代码及受控/真实运行证据；SUSPECTED=有依据但缺因果验证；UNVERIFIED=未验证；NOT A PROBLEM=在明确测试范围内正常。用户原始调用缺日志时另标 UNCONFIRMED。

| 版本 / 依据 | 架构变化与新增执行层 | 旧实现 / 潜在冲突 | 当前证据与判定 |
|---|---|---|---|
| V0.1 / Motion_System_V0.1_Source.zip，package0.1.0，SHA见history-evidence | AgentToolBridge、Mock演示、Proposal、共享Command、基本动画工具；snake_case协议 | 早期Bridge保留；当时没有真实Provider链 | Mock演示不能证实模型工具调用成功；共享Command边界应KEEP。不是“早期就证明真实Agent可靠” |
| 0.9.0 / c967b61 | NativeAgent、Provider manager/compatible Adapter、ToolCalling、Plan、草稿Transaction、VisualInspection | 旧Bridge与Native协议并存于源码/测试 | Native UI走新控制器。旧接口无当前主UI消费，不证明双执行器竞争；历史测试数不能外推实时成功率，采用文档原始记录 |
| 0.9.7 / 1f1a06f | 专业Proposal用Registry工具契约，oneOf tool参数，修补声明100与内部12上限冲突 | Professional12与Native Plan100是不同通道 | 旧声明冲突有历史记录且已修；不能把现版本所有任务都说成12步写上限；开发记录102文件/319测试 |
| 0.9.19 / b026780 | CreationPlanner、CapabilityDiscovery、任务分解、Graph与Scope控制 | 增加executionDomain/strategy/dependency信息；保留旧工具 | 能力协议与执行验证需一致；增层不是缺陷证据；Graph生成器输出连线仍需真实验证 |
| 0.9.20 / 6de3dc4 | 有边界Graph/Scene规划上下文，纠错预算，真实Provider跟进 | 抽象能力目录与具体工具声明一起注入 | 复杂能力/READ预算错误仍见后续归档；与上下文大小因果未证实 |
| 0.9.23 / 工作树版本文档与023实际日志 | createText字体/颜色/对齐正式契约、structured Zod issues、Reference分析/视觉反馈 | 保留后期compile错误字符串包装；没有独立提交 | 当前合法createText声明/运行同源；原用户失败args缺失。023真实记录出现LayerNotFound/READ越权，不能泛化成当前Draft读取错误 |
| 0.9.24 / 工作树文档、024 real-calls/preview | JSON/非法计划恢复、专业READ与视觉修正 | 规划恢复与执行恢复仍不同 | 真实Cubic任务初稿+2refinement未通过；模型path手柄0值不符绝对局部坐标；tool success不等于goal success |
| 0.9.26 / bd2d82c保全快照 | native radial setFill、绝对路径手柄说明、依赖/Command结果验证 | 外层radialParameters record、READ后预检break、执行无纠错仍在 | 18简单任务通过；9受控问题。前述修补没覆盖完整语义/恢复链；PARTIAL REFACTOR，非REPLACE |

0.9.23/24/26 是原工作区未提交变化的组合快照，**无独立Git版本节点**。只用实际文档、日志、文件内容判断这些版本的变化，不虚构提交边界。V0.1 archive不是可证明与HEAD祖先同链的Git提交。

## 架构债务与保留边界

1. 当前仅一条Native正式事务路径。旧Bridge用于历史接口/测试，需后续消费者核验和弃用清单，不在本审计删除。
2. 声明Zod和模型JSON Schema总体同源，但径向动态参数/目标类型/3D变换等支持范围不完整表达；这是语义债务而非全部字段漂移。
3. Proposal/Plan、Registry.compile、Command dry run/postflight并非无意义重复：分别管模型结构、工具翻译、Scene约束与结果；缺陷是验证跨阶段中断和错误语义不一致。
4. CreationCapabilities重复完整工具参数，实际输入开销明显；精简应通过候选能力选择与引用实现，不删掉安全Scope/精确版本信息。
5. Intelligence只输出Proposal；正式写入共享Command/AgentTransaction，内容哈希、嵌入包精确版本、未知节点诊断/导出阻止全部KEEP。
6. 不建议Renderer或Scene重写。基础A/B/C/D通过，不足以排除所有复杂渲染边界，但没有将它们定为长期参数失败主要根因的证据。

## 可审查历史证据

- `outputs/deep-agent-audit/history-evidence.json`：archive SHA/source excerpt、版本Git package/source。
- `docs/ARCHITECTURE.md:181/219/345/349/357`、`docs/DEVELOPMENT_LOG.md:112–116`：历史声明，需与日志区分。
- `AGENT_TOOL_FAILURE_AUDIT.md`、`AGENT_RELIABILITY_FIXES.md`、`AGENT_VISUAL_QA_RESULT.md`：原错误参数缺失、已修项及视觉失败。
- `outputs/agent-reliability-023/`、`outputs/agent-reliability-024/`：真实Provider原始归档。
- `historical-tool-calls.json` 265条是多个文件提取结果，部分重放/复制，不用作独立任务数或失败率。preview-session可能复用后期失败文本，避免重复统计。

具体根因与修复边界以AGENT_ROOT_CAUSE_REPORT/AGENT_REPAIR_ROADMAP为准。
