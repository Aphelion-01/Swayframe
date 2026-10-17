# SF 后续AI路线风险登记

审计日期：2026-10-14（Asia/Shanghai）。本轮只读取产品源码、运行验证、编写审计材料，没有修改业务代码、历史V2-7报告、Git HEAD/分支/index，没有调用付费模型。以下源码链接指向真实1.0.3工作树，不指向当前旧工作区。现场原始记录见 [SF_AUDIT_SNAPSHOT.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_SNAPSHOT.json)。

证据等级严格分为：**已由源码证实 / 已由测试证实 / 合理风险但尚未复现 / 缺乏证据 / 无需修复**。本轮补充测试是缺陷复现，不是修复提交；来源见 [SF_AUDIT_REPRO.test.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO.test.ts)、[SF_AUDIT_REPRO_RESULTS.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO_RESULTS.json)。优先级P0/P1/P2是修复风险分级，不代表已授权开发。

| ID | 优先级 | 风险 / 判断 | 分类及证据 | 准入处理 |
|---|---|---|---|---|
| R01 | P0 | 旧save晚到后把旧path归给新工程 | 已由测试证实：AUD-05；[src/desktop/project-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/project-service.ts:10)saveSnapshot无Project归属检查 | 先修工程身份/操作所有权；确认新工程路径不回写，后续保存不覆盖旧文件 |
| R02 | P0 | pending open期间GUI新修改被覆盖 | 已由测试证实：AUD-06；protect在await前、replace无第二dirty/revision检查 | 明确锁定/取消或重验dirty策略，回归必须保留等待期修改 |
| R03 | P1 | 旧导入结果提交到新工程 | 已由测试证实：AUD-07；[src/desktop/asset-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/asset-service.ts:57)await后读当前Project | 导入/relink/addAssetLayer全链核对同一owner，取消/迟到不能写错工程 |
| R04 | P1 | Scene合法但JSON超过20MB、无法保存 | 已由测试证实：AUD-11；[src/core/project-io.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-io.ts:130)与[src/core/command-schema.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-schema.ts:191)/[src/core/project-schema.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-schema.ts:400)边界不同 | 统一候选可保存性预检；不能只在最后保存时报错 |
| R05 | P1 | linked path被hydrate隐式授予 | 自动授予已由测试证实：AUD-08、[apps/desktop/electron/native-services.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/native-services.ts:26)；真实私文件攻击尚未复现 | 先定义不可信导入/生成与用户打开工程的授权区别；不得让Agent声明路径后自动grant |
| R06 | P1 | raw Command当成外部Tool权限边界 | 已由测试证实：AUD-03直接agent来源可删除locked layer；内部Command本来不是ACL，[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:635) | 内部无需全面重写；外部边界必须复用Registry schema/scope/确认/base guard，不直接暴露project.replace等全集 |
| R07 | P1（Agent准入） | 创建数量/动作类型/依赖可靠性仍失败 | 已由历史真实测试证实：原V2-7报告A1/B1；本轮未付费重跑。[src/agent-v2/runtime.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/runtime.ts:103)/[src/agent-v2/editor-adapter.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent-v2/editor-adapter.ts:51)结构校验不能保证自然语言语义 | V1默认/V2 Beta不变；不得宣称新功能依靠V2创建已可靠；不在本轮重构Agent |
| R08 | P2 | workspace回调异常留下非Scene部分副作用 | 已由测试证实：AUD-04审计callback；[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:706)；实际现有callback异常尚未复现 | 限定原子承诺/错误契约；外部IO不塞到workspace回调，不建设全局万能Transaction |
| R09 | P2 | resources/FileGrants长期增长、路径实文件被替换或链接逃逸 | resources/grants长期保留已由源码证实；压力、symlink与重复读路径攻击合理风险但尚未复现。[apps/desktop/electron/assets.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/assets.ts:9)、FileGrants.normalizePath未realpath绑定 | 后续按明确威胁模型验证，不能声称已实现项目级sandbox/GC |
| R10 | P2 | 颜色工作空间/音视频视觉预览边界被夸大 | 字节算术/straight alpha已由源码与AUD-09证实；AgentSnapshotRenderer无prepareMedia已由源码证实。[src/core/compositing-pixels.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/compositing-pixels.ts:2)、[src/agent/vision.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/vision.ts:87) | 声明格式与预览范围，线性/HDR/音视频全链质量另验，不启动Renderer重构 |
| R11 | — | Undo物理删除共享原文件 | 已追踪路径无需修复：AUD-02引用保护；assets.ts无unlink，renderer仅close位图 | 不实现伪需求的物理GC，不把close当删素材 |
| R12 | — | V2晚到覆盖新工程/GUI，新增合并协调系统 | 现有测试证实拒绝/取消：agent-v2-session-v27.test.ts五种late事件；[src/ui/core-v2-controller.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/core-v2-controller.ts:20)/[src/agent/transaction.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/transaction.ts:170) | 当前覆盖范围无需新系统；同UUID重载等新增回归可先验证，勿全局重构 |
| R13 | — | 完整托管Asset库/生成文件跨Scene回滚已经存在 | 缺乏证据：当前native只是链接，Scene保存链接路径 | 不假设已具备；未来需要生成文件时才定义最小生命周期 |
| R14 | — | MCP/AI2Comp完整入口可直接上线 | 缺乏证据：既有IPC只有DesktopRequest IO，未发现本轮范围中的可上线远程Scene接口 | 不开发、不发布；仅做复用决策 |
| R15 | — | Windows/全部媒体/真实模型已全量通过 | 缺乏本轮完整实机/真实模型证据；本轮Mac启动及109断言不等于这些验收 | 报告明确边界，不拿构建/fixture代替 |

## 停止与准入

核心Scene事务及图片资产路径已确认，因此不触发“无法确认就停止设计”的条件。但已复现的R01～R04阻止当前P1准入。R05/R06必须先定清外部输入权限边界；R07保持Agent准入单独未通过，不能被编辑对照通过覆盖。

本轮结论不要求重新构建Agent/MCP/AI2Comp，不批准增加Registry/Schema/Gateway。修订顺序在 [SF_IMPLEMENTATION_DECISION.md](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_IMPLEMENTATION_DECISION.md)。所有用户原修改、旧版本证据和旧V2-7报告保留。
