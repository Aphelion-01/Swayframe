# Swayframe AI Agent V1 Result

版本：0.9.0。Project schema：0.6.0。基线：`docs/baseline/NATIVE_AI_AGENT_V1.txt`。按A0→A14完成实现与逐阶段门禁；最终285项测试、98个测试文件通过。以下“通过”区分实现/协议/Mock闭环和真实第三方模型验收，不将固定Mock响应当作模型设计质量。

## Working End-to-End Flows

Agent Panel → Provider/Model routing → 相关Scene context → typed读取/专业Proposal → structured Plan → 隔离CommandSystem →真实Renderer/可选Vision检查→共享Transaction一次提交→Canvas/Timeline/Inspector同步→一次Undo/保存重开。

| 场景                  | 结果与证据                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| 1 左侧快速滑入        | 两个真实Position关键帧、可编辑MotionCurve；起止真实渲染交给Mock Vision；一次Undo恢复。         |
| 2 创建HELLO SWAYFRAME | 创建真实Text Layer，中心位置960/540；Renderer和属性面板显示。                                  |
| 3 文字设计            | analyzeTypography只读专业Proposal，再经Plan修改字号96、tracking8、位置与颜色；浏览器真实渲染。 |
| 4 背景模糊            | 共享Graph Service创建gaussianBlur并设置radius12；节点图、Renderer和保存一致。                  |
| 5 多选缩放            | Selection Center、1.2比例；两个位置X从400/1000变为340/1060，中心700不变，一次Undo。            |
| 6 PNG布局参考         | 参考像素进入Vision上下文；仅布局工具权限限制，颜色不变，参考不进入Project Assets。             |
| 7 服务切换            | Mock A限流→有界重试/Mock B；显示fallback，成功结果才提交。                                     |
| 8 无服务/无Key        | 禁用发送并指向Settings；浏览器和原生版均检查，不假装完成。                                     |
| 9 Stop                | 中止模型/工具链并丢弃隔离修改，不产生已提交的局部Scene。                                       |
| 10 保存重开           | 关键帧、Curve、Graph/effect保留；会话数据独立于Project。                                       |

十项结构化自动验收在`tests/agent-v1-acceptance.test.ts`。真实浏览器记录：`outputs/ai-agent/A14-browser-acceptance.json`，包括Canvas、前后预览、Undo、参考、fallback、Stop及保存一致性。模型侧是明确标识的协议Mock；浏览器中的工程、命令、Renderer和界面为实际产品实现。

## Provider/API

实现OpenAI-compatible `/models`和`/chat/completions`，bearer认证、加密自定义请求头、显式模型能力、typed function/tool calls、视觉图片、增量SSE、实际usage和Abort/超时。未知模型不自动标记Vision。Provider CRUD、启用/停用、默认服务、连接测试、模型列表与能力管理可用。

网络/超时/限流/Provider错误最多2次切换或重试，有退避并可取消；无效Key、请求/响应格式和取消不重试。原生contextBridge错误分类已保留。多个任务角色独立路由。协议测试使用受控fetch/SSE和Mock，不需要用户密钥。尚未调用用户真实第三方服务。

## Agent Core

相关Scene Context包含合成、选区、当前时间、属性/关键帧、真实bounds、父级、素材元信息与最近命令；有字符预算，不发送完整Project/素材路径。结构化Plan最多100步骤；规划读取最多4轮/12次；单动作最多500条Command。ASSIST只生成计划，AGENT可应用安全操作，删除/大规模结构修改需要界面确认。切换模式/Skill会取消旧待确认计划。自动视觉修正最多2轮，危险修正拒绝。

## Tools

读取工具、图层/Transform/Shape/Text、Keyframe/Interpolation/MotionCurve、Effect/Graph/Mask、Composition、已导入Asset及真实动画预设工具接入Registry。新建图层可通过Layer ID和属性路径在同一Plan中创建关键帧。Graph和Mask沿用现有数据模型和渲染器，不添加未经基线允许的高级动画模块。

专业只读入口：analyzeLayout/analyzeColor/analyzeTypography/analyzeMotion/analyzeReference。IntelligenceService没有Scene、CommandSystem或磁盘写入接口，返回DesignProposal；Agent读取建议后仍须通过Plan、参数校验和权限检查才能应用。

## Skills

8个内置Skill：通用动效、动画润色、布局、文字、配色、曲线、合成、参考。支持自动/手动选择。用户Skill支持创建、编辑、停用、复制、删除、JSON导入导出。内置指令只读。工具白名单及所需模型能力执行校验，Skill文字不能扩大权限；导入指令不作为代码运行。

## Vision/Reference

使用共享Canvas2DRenderer生成最长边720像素的真实预览，不含选择框，不永久写入Project。当前帧及相关动画起止帧可提供给明确支持Vision的模型；前后图可在Agent面板查看。没有视觉模型或关闭发送预览时，仅报告本地渲染检查，不称作模型视觉验收。

外部参考仅接受用户选择的File：PNG/JPEG/WebP、GIF首帧、可解码视频的3帧。最多2个参考/6帧；单文件200MB上限，图片请求有大小限制，解码等待有超时和取消。参考chips、移除与整体/布局/颜色/字体/形状模式可用。Layout-only工具范围阻止颜色写入。GIF首帧在界面明确标记，不宣称完整GIF时序理解。

## Settings

“设置 → AI”包含服务、模型、路由、Agent、Skills、用量、隐私。密钥不在聊天面板配置。仅统计服务返回的token和费用；未知费用显示未知。保留最近500次调用及31天合计。预算80%提醒，100%可阻止后续请求。关闭参考/预览发送会实际移除对应像素。

工程绑定会话历史、新会话、恢复和清除，以及真实动画属性预设属于应用数据。预设存Property/Keyframe/Curve，应用时保留目标Property ID并生成新Keyframe ID；不把聊天内容当成动画预设。预设沿用保存的绝对数值/时间，界面明确说明。

## Security

原生凭证由Electron主进程使用异步safeStorage加密，Renderer只有“已配置”状态；生产安全存储不可用时拒绝保存，不落明文。仅开发模式允许临时内存凭证。限制IPC来源、请求Schema、请求数量、固定数据文件键、文件体积及目录/文件权限；密钥不进入Project、Scene Context或日志。凭证/请求头换行注入拒绝。

禁止shell、eval、任意JavaScript/Node、DOM模拟操作和LLM任意读盘。Agent只能访问已导入/授权的Asset。图层文本、文件名和参考内容视为不可信数据。安全存储持久化/权限通过注入加密器测试；macOS原生版已实际确认安全存储可用状态，未输入或测试用户真实Key。

## Undo/Transaction

GUI与Agent共用Command/Transaction。隔离阶段不改变真实Scene、不触发恢复保存；提交前验证工程身份，检测到人工并发编辑就拒绝。一次成功动作产生一次Undo并触发既有dirty/recovery。Stop、工具失败及验证耗尽丢弃未提交修改。工程切换到更短合成时，隔离操作和验证时间限制在新时长内；提交后重置播放头/选区。

## Tests

| 阶段 | 通过测试数 |
| ---- | ---------: |
| A0   |        227 |
| A1   |        234 |
| A2   |        238 |
| A3   |        240 |
| A4   |        242 |
| A5   |        245 |
| A6   |        248 |
| A7   |        251 |
| A8   |        254 |
| A9   |        257 |
| A10  |        260 |
| A11  |        263 |
| A12  |        267 |
| A13  |        270 |
| A14  |        285 |

各阶段均运行typecheck、lint、完整unit/integration tests、Web build、desktop build；日志`outputs/quality/A0.log`～`A14.log`。最终A14：98 files / 285 tests / 全部门禁PASS。旧GUI集成测试曾在高负载下触及5秒超时，未调宽测试阈值；最终完整重跑通过。最终独立QA入口也通过额外typecheck。

真实macOS安装包副本使用隔离资料目录验收：0.9.0启动、新建工程、Agent无服务/无Key状态、设置七个分区、系统安全存储可用、原生服务配置保存/删除。未连接示例服务。Windows构建成功，运行验收尚未完成。两个ASAR的main/preload/index及主前端资源已逐文件与最终门禁构建比较一致，见`outputs/ai-agent/A14-package-payload.json`。

性能：500图层/50,000关键帧/120帧，平级工程求值平均每帧0.445ms，父级工程0.585ms（运行机实测，详见`A14-performance.log`）。这只测Scene/动画求值，不等同于Canvas、Vision请求或所有复杂效果的性能。

## Incomplete

真实第三方模型的连接、自然语言理解质量、视觉设计判断和供应商兼容性尚未以用户凭证验收；不能以Mock结果替代。视频/GIF未覆盖全部编码器和真实素材来源，也没有完整视频/GIF时序理解。Windows运行/安装尚未实机检查。安装包未签名/公证，沿用默认Electron图标；专业品牌图标和签名证书未提供。Web生产环境不永久保存Key，应使用桌面版。

## Blockers

开发和Mock闭环无外部阻塞。真实Provider验收需用户在Settings自行配置Provider/API Key/Model及Vision能力；不在本轮索要Key。Windows实机验收和签名/品牌资源属于明确外部依赖。

## Next Highest Value

先使用用户选定的真实Provider逐项复核以上十个场景，收集模型Plan/tool-call兼容和视觉反馈，再针对实际失败样例补测与修复；随后补Windows实机和常见视频/GIF格式验收。不进入新的高级功能扩张。

## Delivery

`release/Swayframe-0.9.0-arm64.dmg`、`release/Swayframe Setup 0.9.0.exe`、`release/Swayframe-0.9.0-Source.zip`及`release/Swayframe-0.9.0-SHA256.txt`。开发源、架构、基线、阶段日志与结果报告保留在当前工作区。
