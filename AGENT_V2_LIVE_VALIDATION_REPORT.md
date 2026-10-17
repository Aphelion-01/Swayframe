# Agent Core V2 / V2-5 live validation — 1.0.1

2026-10-12 状态：**五类基础任务 LIVE VERIFIED，V2 Structured Intent LIVE VERIFIED；正式替换 NOT READY。** 这是小规模 Smoke，不能证明长期可靠性、95% 成功率或高级创作能力。

## 1. 授权和实际调用

用户本轮明确指示“调用付费Api测试”，授权同轮已提出的最多20次实际请求（含恢复/重试）、300000输入 tokens、40000输出 tokens。授权记录：`outputs/agent-v2-5/authorization.json`。只发送独立合成的测试文本与工程摘要，没有发送图片、真实用户工程或密钥。

实际使用现有 NativeAIService / OpenAICompatibleProvider / AIProviderManager，读取原安全凭证，不导出凭证、不修改用户设置。Provider DeepSeek，端点 https://api.deepseek.com/chat/completions，请求和实际返回 model 均为 deepseek-flash。16次请求均HTTP 200。累计 **165691输入 / 7275输出 tokens**，未知用量0；尚余4次请求，已停止调用。原始响应 usage 与应用 Token Accounting 逐条汇总一致。实际费用以供应商账单为准，不把估算写成扣费记录。

唯一累计账本：`outputs/agent-v2-5/live-smoke/live-calls.json`。初测 report 的12次是前12次；补测 report 的16次是累计值，不能相加为28次。发送前占额，每例最多3次HTTP、每次最多2000输出；未知用量保留保守预留。没有额外重试、模型切换或图片探测。

## 2. 全部任务结果

| 任务 | V2 初测 tools | V1 初测 tools | V1 匹配权限补测 |
|---|---|---|---|
| A 三个RGB矩形，第二个改紫色 | PASS，1次 | PASS，1次 | 未重跑 |
| B Cubic文字、字体、字号、位置、颜色 | PASS，1次 | PASS，1次 | 未重跑 |
| C 原生径向渐变中心、半径、色标 | PASS，1次 | PASS，1次 | 未重跑 |
| D 两秒线性位置动画，中间帧(950,540) | PASS，1次 | FAIL，2次 | PASS，1次 |
| E Gaussian Blur实例 | PASS，1次 | FAIL，1次 | PASS，3次 |

V2另一次 Structured Intent A：PASS，1次。该模式通过明确 JSON 文本协议和同一严格 Schema，不代表供应商支持原生 `json_schema` response_format。tools 模式实际返回 submitIntent Function Calling，不自动降级。

E仅验证实例添加和可序列化 Graph，默认Radius=0；**Blur Radius调整 NOT IMPLEMENTED in V2，非零模糊视觉效果 NOT VERIFIED**。不能用这个任务证明实际模糊能力。Cubic字体和渐变实际Renderer PNG已人工检查，所有成功样本另经独立数据断言、实际720×405渲染与像素检查。

## 3. 失败原因和对照限制

初测V1目录展示全套工具，测试host却只准许与V2相同的9个基础写工具。D模型选用了可见的 animateLayerProperty，执行被测试host拒绝：TOOL_NOT_ALLOWED。E生成的 gaussianBlur创作任务声明要求 createNode/setNodeParameter，却安排 addEffect，预检 CAPABILITY_UNAVAILABLE。这两例不能归因于DeepSeek端点，也不能作为V2架构优越性的证据。

为排除测试条件干扰，只补测D/E：通过测试层过滤真实V1 Registry catalog，显示READ和同样9个WRITE；原Native V1规划、执行、恢复、Command与Transaction算法均未替换。D改用两个addKeyframe并通过；E先进行两轮只读能力/契约查询，第三次submitPlan声明addEffect并通过。查询是规划取证，不是假报为自动恢复。

初测5个V1样本3/5、5个V2样本5/5；补测V1单独2/2。**不得合并为一轮新的V1匹配条件5/5，也不得宣称V2成功率100%或明显优于V1。** 展示目录条件不同、各类仅一次、缓存状态不同和额外查询均影响统计与耗时。未来正式比较需新预算下完整统一条件的独立重复样本。

| 指标 | V2 tools初测(5例) | V1初测(5例，目录不匹配) | V1补测(2例) |
|---|---:|---:|---:|
| Full Task Completion | 5/5 | 3/5 | 2/2 |
| Tool Validation Failures（Schema/参数） | 0 | 0 | 0 |
| Object Reference Failures | 0 | 0 | 0 |
| Plan Failures（规划/依赖） | 0 | 0 | 0 |
| Automatic Recovery（执行失败恢复） | 0 | 0 | 0 |
| Unexpected Mutations | 0 | 0 | 0 |
| HTTP请求 | 5 | 6 | 4 |
| 输入tokens | 58833 | 66107 | 30099 |
| 输出tokens | 1710 | 3716 | 1411 |
| 中位端到端耗时(ms) | 1989.7 | 4201.9 | 4107.95 |

上述0个Schema/引用/规划错误不包含另行记录的测试权限拒绝1例及能力预检拒绝1例。V2 Structured单例另计10652输入/438输出 tokens、2294.3ms。指标覆盖所有成功和失败，不挑选有利样本。

## 4. 安全和证据

13个任务尝试全部保持接受前正式工程不变；11个成功样本各一次正式Commit，Undo精确恢复base、Redo恢复结果，保存/加载一致。两例失败Commit=0；意外修改0。Protected对象保持原样，V2真实引用来自工具返回。不会把模型生成字符串当实际对象ID或提交失败草稿。

全部请求、模型原文、解析、引用、Command状态、失败阶段、Scene、PNG和用量分别保存在 `live-smoke`、`live-matched-recheck`；原始初测失败完整保留。`live-comparison.json`汇总两组；`live-evidence-audit.json`复核16条账本、预算、无图片/无headers及成功/失败提交不变量。

原工作区542个保护文件SHA256、原HEAD、branch、index与保护清单一致。当前1.0.1产品源码和Mac/Windows安装包哈希也与上一轮清单一致，本次仅改测试harness、报告及验收记录，未重打包相同源码。

## 5. 验证边界和下一门禁

上一轮161 files / 747 tests、typecheck/lint/build/desktop build、四尺寸UI、Mac包启动已通过。本轮真实Renderer、事务、引用、Undo/Redo、序列化、实际账本验收通过。端点正常请求已实测；网络失败、取消、错误工具/非法JSON的拒绝只经离线测试，本轮没有故意付费制造故障。Windows包只验证NSIS构建，未在Windows实机运行，两端未签名。

开发者隔离测试可用，默认助手仍Legacy V1。**正式工程Canary NOT READY，正式替换 NOT READY**：尚无扩大独立重复样本和真实用户工程验收。没有自行扩到100次。Skill、Forge、参考图重建、高级生成节点、Blur Radius编辑未迁移。本次交付真实小规模结果，扩大验收须另授权。
