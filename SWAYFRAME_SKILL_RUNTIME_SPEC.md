# Native Skill Runtime 1 / Swayframe 0.10

NativeSkillRegistry 只加载随应用编译的六个包。包由 manifest.json、workflow.json、SKILL.md、tests/cases.json 构成；manifest/workflow 经 strict Zod 检查，版本与内容 SHA-256 固定。validatePackage 仅接受内置精确内容，不能加载外部指令、系统命令或新的编译器。cases.json 是测试索引，正式可执行回归在 tests/ 中，不能把索引存在当用例执行通过。

manifest 描述 id/name/version/description、supportedTasks、required/optionalCapabilities、supportedObjectTypes、inputs/outputs、prerequisites、permissionRequirements、compatibility 与 recoveryPolicy。workflow 约束注册工具、真实绑定、依赖、共享事务、有限恢复及验证；入口动作将正式 plan 路由到相关技能。Skill 仅参与计划指导、契约/依赖与验证选择，实际场景写入只有既有 executor。

默认加载 Core Execution 与关键词匹配的创作技能；正式 plan 的 entryActions 可补充路由。停用技能跳过指导，底层能力仍受原 Registry 权限约束；缺少真实 requiredCapability 则报告，不宣称技能可运行。关闭原生 Skill 不关闭引用、命令或恢复系统。

设置复用现有 AI → Agent 参数 Section：总开关、五创作技能开关。旧 builtin/user Prompt Skill 保持兼容，不因此获得原生能力或权限。无 Marketplace、远程插件、eval、Function、任意文件或 shell 访问。

工作记忆记录目标、当前合成、捕获选择、实际创建引用、完成/待办/失败任务、恢复记录数量、约束与 draft 指纹。恢复提示只携带精简记忆及失败工具契约，不重放完成任务。
