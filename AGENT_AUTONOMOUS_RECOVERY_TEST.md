# Agent Autonomous Recovery Test — 0.9.30

| Benchmark | 验证与结论 |
|---|---|
| B1 历史 Cubic 依赖 | 脱敏历史保留真实前缀；受控 native 完整样本修复逆序 task 元数据、创建 Cubic/Times New Roman/110、单提交、Undo。历史完整 task 表丢失，精确历史重放 NOT VERIFIED |
| B2 Rectangle → radial → position → keyframes | 原生 Transaction 注入参数错误，仅纠正 fill；无重复图层/gradient，后续位置与关键帧完成；单提交、Undo/Redo |
| B3 Text → Font → Position → Opacity + READ | 真实模型自由规划及受控修复均完成；原生 stepResult 解析、READ 后仍验证写步骤；字号64、Times New Roman、两帧动画；自由规划位置960/540 |
| B4 Circular Dependency | 检测循环，有限修改现有依赖；无效修复两次上限，禁止无限排序/非法提交 |
| B5 identical invalid plan | 同一候选/错误摘要停止第二次无效修复；creation 参与摘要；保留诊断 |
| B6 mid-draft failure | 已完成创建/关键帧保留；只恢复失败步骤，或 discard 保证正式工程无部分写入；一条 Undo |

测试文件：agent-autonomous-recovery、agent-execution-recovery、agent-object-reference、agent-plan-recovery、agent-text-reliability、agent-intelligence、agent-v1-acceptance、native-agent-panel、ai-failover、ai-settings。正常执行完整套件，不跳过既有测试。

UI/Feature Placement Review：恢复状态与开发者日志复用 ASSISTANT / assistant.actions；应用低频预算在既有 AssistantMode Section 内折叠；没有全局新按钮、Misc 分类或 Scene 配置。已更新 FEATURE_INVENTORY / FEATURE_LOCATION_MATRIX。DOM 测试检查开发者详情默认折叠、预算修改即时保存；注册表/入口审查仍在全量测试中。

UX heuristic：状态可见、普通用户不默认看到嵌套 JSON；错误保留输入；恢复终止保留诊断；取消/权限不自动重试；配置按阶段命名，避免一组全局极小额度误截断合法多阶段任务。

真实调用使用现有 NativeAIService 与安全存储凭据，不在脚本/报告保存密钥，关闭图像外发。首轮适配器 maxTokens 被本地严格 schema 拒绝，0 API 请求；保留在 adapter-preflight-failure。修正后实际 4 次请求（DeepSeek/deepseek-flash），输入11,408、输出1,383 tokens；授权限6次/300,000输入/12,000输出。原始调用/Session/Scene/实际渲染图保留，独立复核见 live-review.json。未重复请求以凑预算。
