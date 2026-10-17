# Agent Core V2 迁移计划

当前正式迁移状态：**NOT READY**。

V2-0～V2-4 的核心代码及离线验证完成。V1 保留且可构建、可回退；1.0.0 普通 AI 助手仍默认 V1。V2 ESM 模块已随构建保留，当前仅通过独立工程的隔离测试入口运行，不存在两个同时绑定普通工程的执行器。开发调用示例见 `work/agent-v2/README.md`。

未完成真实 Provider Smoke/重复可靠性验收。因此不得把 V2 切为默认、删除 V1 或立刻开放所有旧工具。此前授权的 12 次 DeepSeek 请求已在 0.10.1 用完；本轮没有追加请求，也未发送素材。

下一阶段 V2-5：经明确预算批准，使用同 Provider、同模型、尽可能一致采样设置与五组验收，先小规模真实 Smoke；保留请求数、输入/输出 tokens、耗时、成功/失败、恢复、错误对象与意外修改。之后取得独立样本预算，建议每条路径5×20真实任务；95% 是工程目标，必须报告样本限制。没有严重越界、数据丢失、未经接受提交、恢复重复创建时，才能考虑 READY FOR CANARY。不能用本轮固定响应100/100替代该门禁。

受限 Canary 需要适用授权、稳定对象范围、清晰草稿预览/接受、取消、回退 V1。当前没有增加用户入口；后续入口必须遵循 DESIGN.md/功能注册与位置审查。经过 Canary 完整回归及真实验收才可 READY FOR DEFAULT。

V2-6 高级创作：按 Graph、Creative Skills、Reference Analysis、Effect Forge 逐域端到端→Runtime接入→真实Provider验证。Skill只输出指导，不能再持有状态、引用或第二套恢复。Visual重构质量单独验收。

回退：切回保留的 0.10.1 分支/安装包；V2 使用原 schema 与 Shared CommandSystem，没有工程迁移、远程包下载、正式库覆盖或核心渲染算法变更。

## V2-5 / 1.0.1 checkpoint

Provider session、explicit responseMode、开发者独立工程入口与offline集成完成。2026-10-12获本轮付费授权，实际16请求/165691输入/7275输出；V2基础tools五类5/5、Structured Intent 1/1，LIVE VERIFIED限定于此Smoke。V1初测目录与执行权限不匹配，相关D/E两例补测通过，全部记录保留；不据此宣称统计优势。生产default仍Legacy V1，正式工程Canary及替换NOT READY。扩大独立重复样本另授权，不把小样本通过当95%可靠性。
