# Swayframe 1.0.4 — Assistant Chat & Bounded Recovery

## 范围

基于 `eacb25d`，独立分支 `codex/assistant-chat-workflow`。保留 V1 默认、V2 显式选择和原有审阅 / 直接编辑模式。未修改历史 V2-7 报告，未调用付费模型，未改用户当前运行的工程。

对象是当前 Agent 会话与原生图层；主任务是描述需求、指定对象、观察执行和审阅结果。频率 F2/F3，固定域 ASSISTANT，唯一规范入口 `assistant.actions`；沿用左侧助手，不增加全局工具栏按钮。

## 界面

- 独立滚动的对话记录、底部输入区。引擎和旧离线建议收进设置菜单；旧建议明确标为离线示例。
- 共享 `AssistantComposer` 提供图标发送 / 停止、TXT / Markdown 提示词、Skill、模型、思考深度、清空上下文。Enter 发送，Shift+Enter 换行，输入法组合时不发送。
- 图标有名称、悬停提示、焦点、按压反馈；消息和标签轻量入场，处理中状态点脉动，尊重 reduced-motion。
- 显示 Runtime 的实际规划、执行、恢复、验证、审阅与失败状态；步骤和诊断默认折叠。不显示或生成内部思维链。
- 选中图层在输入区高亮，名称用于显示。V2 发送结构化 `projectId`、`compositionId`、`layerIds`，交由原 `ConversationSession.validate` 校验。V1 继续使用真实选区上下文。无选中时仍可创建。
- 清空会话丢弃未接受草稿，保留正式 Scene 和 Undo；V1 同时清除参考附件。提示词文件晚到不能覆盖已清空 / 新输入 / 新工程。
- 模型选择保存既有 planning route；不更换凭据实现。V2 Skill 仅使用精确编译内置包，不能扩权、安装工具或修改源码。
- “快速 / 标准 / 深入”改变送入原 Planner 的规划和检查要求；**不伪称调整所有第三方端点的内部 reasoning 参数**。选项中明确说明，预算不增加。

## 定向恢复

复用 `TaskRuntime`、`AgentPlanner`、`ProviderBridge` 与 `AgentTransaction`，没有第二套 Planner、Registry、Scene 或 Undo。

1. 缺少完整工具计划、结构化返回损坏、Schema / 依赖 / 显式创建数量失败：在原预算内携带校验反馈完整重新规划一次。第二次仍失败即停止；不静默删除动作、不切换协议。
2. 原生参数修复允许修改值字段；工具、动作 ID、依赖、目标、资源标识、属性路径、文本目标保持不变。修复后仍经原 Registry、参数预检查、Scene 与渲染验证。
3. 已完成步骤保留；失败动作若已修改草稿、关闭事务或基线过期，拒绝盲目重放。正式提交仍是一笔原生事务。
4. 临时网络 / 超时 / 限流 / 服务 5xx：同服务同模型最多重试一次；请求总量仍最多 3 次，模型修复最多 2 次，执行最多 180 秒。限流等待超过余量即停止。认证、权限、缺失模型与不支持协议不自动重试。
5. 恢复记录包含原错误、方式、次数、结果与草稿版本；Provider 错误展示安全 code / HTTP 状态，不把远端响应正文或密钥带入提示。

无法安全继续、能力不支持或预算耗尽时明确结束，不能保证任意任务无限尝试到成功。V2 的新 Live 能力状态仍未验证，本轮结果不构成 Canary Ready。

## 验证与证据

- `npm run typecheck`
- `npm run lint`
- `npm test -- --maxWorkers=2 --reporter=json --outputFile=docs/qa/assistant-chat/unit.json`
- `npm run desktop:build`
- `node work/assistant-chat-qa/build.mjs`，随后以独立 `SWAYFRAME_USER_DATA` 运行编译入口。

结果与版本冻结信息见 [QA 报告](docs/qa/assistant-chat/README.md)。Electron 使用实际 App、原生 Controller / Registry / Command / Transaction / Renderer。Provider 是明确标识的受控离线响应，禁止网络请求；不冒充真实模型成功。jsdom 测试的 Renderer stub 不用于端到端结论。

Mac arm64 / Windows x64 安装包放在 `release/`，打包后逐文件比较生产构建与 app.asar；不嵌入 QA bundle。未签名 / 公证，Windows 没有实机运行验收。未自动替换当前 `/Applications/Swayframe.app`，避免打断用户工程。
