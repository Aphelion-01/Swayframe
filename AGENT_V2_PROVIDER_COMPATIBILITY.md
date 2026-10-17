# Agent Core V2 Provider compatibility — V2-5 / 1.0.1

2026-10-12：实际DeepSeek deepseek-flash端点通过小规模正常请求测试，16次HTTP 200；仅认证下表列出的路径，不泛化到所有模型/协议。

| 能力 | 实现/离线状态 | 当前端点实测 |
|---|---|---|
| 既有配置、Native安全凭证、HTTP归一化 | CONFIGURED，不导出密钥 | LIVE VERIFIED，实际返回deepseek-flash |
| tools / submitIntent Function Calling | 严格V2 Schema，单一工具 | LIVE VERIFIED，五类各1次 |
| Structured Intent原始JSON文本 | 同一Schema/引用/作用域/Command | LIVE VERIFIED，A任务1次；不证明原生json_schema |
| 实际Token Accounting | HTTP原始usage与应用账本 | LIVE VERIFIED，165691输入/7275输出、未知0 |
| 九个基础工具、真实引用、Transaction/Renderer | OFFLINE VERIFIED | LIVE VERIFIED，V2六例及V1成功尝试 |
| 网络失败分类、Cancellation | OFFLINE VERIFIED | 本轮未制造真实故障，LIVE NOT VERIFIED |
| 缺工具、多工具、错名、部分/非法JSON拒绝 | OFFLINE VERIFIED，不自动降级 | 本轮正常响应未触发，LIVE NOT VERIFIED |
| Blur Radius参数编辑 | NOT IMPLEMENTED in V2 | NOT IMPLEMENTED，不以0半径证明模糊 |
| Skill / Forge / 参考图重建 / 高级节点 | NOT IMPLEMENTED in V2 | 本轮禁止迁移 |
| Claude原生协议 / 任意其他Provider | 只复用既有openai-compatible | NOT VERIFIED |

只发送独立测试文本和合成摘要，不发送图片。tools与Structured Intent显式选择，没有把网络错误解释为协议不支持，也没有静默换模式或供应商。Normal manager/native transport仍负责凭证、HTTP和用量。固定路由保护只经离线异常注入，不故意修改用户设置。

真实trace、预算和V1测试条件限制见AGENT_V2_LIVE_VALIDATION_REPORT.md。小样本通过不证明95%可靠性或正式替换条件。
