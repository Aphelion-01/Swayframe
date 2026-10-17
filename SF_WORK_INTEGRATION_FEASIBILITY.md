# SF / GPT Work Integration Feasibility

日期：2026-10-16。**GPT Work 集成未验证。通用外部 Agent 工作流已验证（Codex文件工具+独立官方MCP客户端+原生GUI协助）。**

## 实际可用能力

| 客户端/能力 | 本轮证据 | 状态 |
|---|---|---|
| 当前Codex文件和进程工具 | 新生成PNG、manifest、本地P7调用及原生工程产物 | 已验证 |
| 独立Node官方MCP Client 2.3.1 | 两次25项E2E，实际stdio调用、loopback鉴权、正式SF页面/Scene变化 | 已验证 |
| Codex应用原生安装SF MCP配置 | 本轮没有写入或重启该配置 | 未验证 |
| ChatGPT Work本地文件访问 | 没有运行GPT Work测试会话或检查其账号/策略权限 | 未验证 |
| GPT Work→SF MCP→Scene→渲染 | 没有来自Work的真实工具调用和SF变化证据 | 未验证 |
| 云端Work访问本机127.0.0.1 | 不能从本机Node成功推断云端可达；未建立隧道 | 未验证 |

当前工具面只能确认本次Codex具有文件/进程执行能力；它不证明另一个Work会话已获得同一文件权限、临时令牌或本机MCP配置。未新建GPT Work会话，不请求其分享账号或密钥。

## 官方文档调查，不等于实测

OpenAI Docs核对：官方说明Work可使用已批准的文件/插件/工具，桌面本地能力取决于可用工具及权限。这不能证明本账户或特定会话已启用。见[Work入门](https://learn.chatgpt.com/docs/get-started-with-work)。

官方MCP说明区分本地stdio配置与托管/网页插件：网页不会直接读取本机Codex配置；需要核对具体执行宿主、连接和认证。见[Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)。

如果未来采用桌面插件发布，官方将本地MCP提交限制于已批准合作方，不能把本次自用客户端验证写成获得插件目录发布资格。见[Desktop-only插件提交](https://developers.openai.com/plugins/deploy/desktop-only)。本轮没有提交插件、开放公网、配置隧道或尝试绕过平台权限。

上述来源只支撑有条件的技术可行性，不是GPT Work集成PASS。没有必要为本阶段新建网络Gateway或改变SF默认关闭/一次会话/显式目录授权规则。

## 后续最小验证条件

只有用户明确要求验证特定Work环境后，才能在该实际会话中确认：本机文件/stdio工具可用、SF临时配置安全交接、主动授权、真实listTools/Scene查询/位置编辑/撤销/导入/渲染/保存重开，并留存Work侧调用证据。连接失败必须保留真实错误，不能用另一个Node客户端代跑后标Work成功。

若Work不能连接，仍可由其输出标准Layer Package，在SF原“导入分层合成…”确认；这属于文件交换工作流，不属于Work→MCP直连。

## 当前使用边界

可以使用本轮包和工程演示“通用外部 Agent 工作流已验证”。不得写“GPT Work 集成已验证”、纯MCP全自动创建动画、跨平台端到端PASS或任意图片还原。MCP缺少首次开启关键帧和保存命令，本轮通过原生GUI明确协助，不为演示扩展权限或引入任意脚本工具。
