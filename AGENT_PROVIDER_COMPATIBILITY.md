# Provider compatibility 0.10

供应商兼容性按具体配置和实测分别记录。providerCapabilityProfile 对模型 Tool Calling、Structured Output、上下文上限与并行调用保留 unknown；vision 来自配置，不能凭供应商名称自动宣称具备。适配器支持 JSON 工具/SSE、Abort、严格文本计划与错误协议，不等于每个供应商均获认证。

OpenAICompatibleProvider 集中处理 HTTP/SSE/JSON。HTTP 错误只保存有界白名单 status/code/field/requestId/Retry-After，不保存原始正文或 key。401/鉴权、协议错误不做无限网络重试；网络/超时/429/5xx 只按共享阶段预算有限重试。Retry-After 超过当前短重试窗口即停止，不能提前重试。半截 JSON、未完成 SSE、finish_reason=length 不产生可执行计划。

Agent 设置可选择工具调用或 structured-plan。后者把同一权威工具契约编码为严格 JSON envelope，完整解析并规范化为 ChatResponse.toolCalls，再进入相同 host 校验；不是宽松文本执行或新的编辑逻辑。不自动把 401 改为文本重试。

Electron IPC/preload 保留白名单结构化错误，界面去掉桥接编码。Provider/Model 与所有成功/失败请求耗时进入 trace；失败请求没有 usage 时标未知，不能计为零成本。

离线覆盖：HTTP 401/429/5xx、正文脱敏、半 JSON、SSE 不完整、文本/工具等价、桌面错误桥。真实 DeepSeek 与 Skill 对照及授权消耗见 AGENT_RELIABILITY_BENCHMARK.md；其他供应商未做真实认证。
