# Agent Core V2 Canary result — V2-5 / 1.0.1

**开发者隔离入口可用，基础真实Smoke通过；正式工程Canary NOT READY，正式替换 NOT READY。**

2026-10-12用户授权后，V2五类tools任务5/5、Structured Intent一例1/1，均一次真实DeepSeek请求；全部通过独立目标断言、真实Renderer、接受、一次共享事务、Undo/Redo及保存/加载。累计付费调用16次（含V1初测和补测），输入165691、输出7275 tokens，无图片，意外修改0。完整失败和测试条件限制见LIVE_VALIDATION_REPORT，不将V1初测目录不匹配造成的失败说成V2优越性。

普通助手仍Legacy V1；开发者 #agent-v2-test 仅在助手原有typed/scoped入口出现。明确启用后创建独立空EditorStore，不能接收/覆盖用户工程、没有持久化或自动保存。预览与接受/拒绝使用既有TaskRuntime/AgentTransaction，失败保留输入，停止/关闭拒绝草稿，关闭返回V1。V1/V2不共享可写工程。

上一轮747 tests和四尺寸真实UI检查通过，默认禁用、待接受、接受与Undo/Redo经offline fixture覆盖。本轮没有把真实API请求偷偷接入用户当前工程。该入口允许人工隔离体验，但未进行真实用户Canary，因此不会凭Smoke直接切生产缺省。

扩大独立重复样本仍需另授权；100例未运行，95%不是已达成指标。Skill、Forge、参考图重建、高级节点与Blur Radius编辑未迁移。原1.0.0、原用户未提交修改和542个保护文件保持；工作分支codex/agent-v2-provider-validation-1.0.1。

本次产品源码未改，现有1.0.1 Mac arm64 DMG与Windows x64 NSIS包哈希一致，可继续用于开发者测试。Mac包已启动检查，Windows未在实机运行，两端未签名。
