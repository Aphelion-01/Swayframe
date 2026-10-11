# Swayframe V0.3 Effect Engine 验收报告

日期：2026-10-08。基线：`docs/baseline/UNIFIED_EFFECT_ENGINE_V03.txt`。V0.3 为本轮架构代号，沿用当前应用版本号。完成 Phase 0–7 的本地实施与验证；外部模型的实际生成行为、GPU 实时性能及安装包签名不在本次已验证结论中。

## 阶段门禁

| 阶段 | 单元及集成测试 | typecheck / lint / Web build | desktop build |
| --- | --- | --- | --- |
| 0 审计 | 466 通过 | 通过 | 无桌面变更 |
| 1 统一 Registry | 468 通过 | 通过 | 通过 |
| 2 统一 UI | 469 通过 | 通过 | 通过 |
| 3 径向渐变 | 472 通过 | 通过 | 通过 |
| 4 程序化 Runtime | 476 通过 | 通过 | 通过 |
| 5 用户库 | 479 通过 | 通过 | 通过 |
| 6 Agent Forge | 481 通过 | 通过 | 通过 |
| 7 完整集成 | 486 通过，129 文件 | 通过 | 通过 |

日志位于 `outputs/effect-engine/phase*.log`。最终 desktop build 同时执行 Web build 和 TypeScript 检查。构建仍有已有的大文件体积提示，没有构建错误；未以此提示宣称性能达标。完整测试包含功能入口注册、位置预算、旧工程迁移、Command、Undo、动画、导出等既有回归。

## TEST-01–14

| 验收项 | 证据及结论 |
| --- | --- |
| TEST-01 原生模糊编辑、渲染、Undo/Redo | `compositing-ui`、`compositing-commands` 测试及真实浏览器：半径 6 的模糊改变像素，Undo 恢复原图、Redo 恢复模糊图。通过。 |
| TEST-02 Graph 模糊连接与渲染 | 实际 Canvas Source→Gaussian Blur→Output 执行。通过。 |
| TEST-03 Inspector / Graph 同定义 | Registry 元数据断言；非零模糊的兼容效果入口与 Graph 入口逐像素相等。通过。 |
| TEST-04 Fill / Generator / Graph 径向渐变 | 三种入口调用共享算法；实际 192×108 Canvas 输出逐像素相等。通过。 |
| TEST-05 自定义程序加载、校验、编译、预览 | `.sfe.json` 经真实声明式解释器生成 RGBA，工坊显示实际像素。通过；本代格式不是 WGSL。 |
| TEST-06 参数更改更新输出 | Runtime 修改 density 后像素改变；参数变化复用同一编译对象；Schema 自动生成 Inspector。通过。 |
| TEST-07 关键帧与时间 | Graph 对 density 的标准 Property 关键帧求值后像素改变；time 变化输出变化，缓存失效。通过。 |
| TEST-08 保存、重开、渲染 | 项目序列化再加载，内嵌包、版本、参数、连接保持，实际像素相等；用户库在页面重载后可见。通过。 |
| TEST-09 非法程序诊断 | 前向引用、未知参数、可执行 JS、错误哈希及超限被拒绝；缺失包节点保留，导出停止。通过。 |
| TEST-10 Agent 选择原生 Blur | 通过 effect_search 和 effect_addToLayer，在真实 AgentTransaction 中添加原生 gaussianBlur，未生成草稿。工具链测试通过；外部 LLM 自主选择未实测。 |
| TEST-11 Agent 选择原生渐变 | 同上，搜索并应用 radialGradient，未生成草稿。工具链测试通过；外部 LLM 自主选择未实测。 |
| TEST-12 Agent Toolmaker | 测试创建与示例不同的新指令源，validate→compile→真实 preview→evaluate→Transaction apply→Undo/Redo。实际 UI 另完成预览、检查、应用、显式保存。运行链通过；未调用外部模型验证自然语言生成质量。 |
| TEST-13 版本固定 | 库增加 1.1.0 后旧工程仍使用 1.0.0 的哈希和像素；同版本异内容拒绝覆盖；删除库条目不影响工程内嵌包。通过。 |
| TEST-14 Preview / Export 一致 | 同一 0.75s 帧的真实 Canvas 与导出 PNG 解码后逐像素相等；缺失效果时停止导出。PNG 路径通过；视频共用 OutputFrameRenderer 且有错误门禁，本轮未逐帧解码比较视频。 |

测试中的 UI Canvas spy 只验证组件生命周期；像素结论来自独立的真实浏览器 Canvas2DRenderer，不来自 mock。复查方法：运行开发服务器，打开 `/outputs/effect-engine/benchmark.html`，点击“运行渲染与导出验证”。源代码为 `scripts/effect-engine-browser-benchmark.ts`。最终结果保存在 `outputs/effect-engine/browser-verification.json`。

## 功能放置与 UX 检查

对象为 Layer / Effect / GraphNode / Property；高频调参归 INSPECTOR，连接归 COMPOSITING，图形填充归 Appearance，独立生成器创建归 SCENE；低频导入和草稿管理归同一个 Effect Browser。复用现有 Section、Modal、创建菜单和 typed contributions，未添加永久全局按钮。FEATURE_INVENTORY 与 FEATURE_LOCATION_MATRIX 已更新；注册校验由完整测试执行。

真实界面完成：创建草稿→验证→编译→预览→填写检查结论→应用→单独保存到用户库→重载后找到效果。检查 1280×720、1440×900、1920×1080、2560×1440；弹窗关闭入口保持可达、内容可滚动、没有页面横向溢出。截图和尺寸边界记录位于 `outputs/effect-engine/viewport-*`。

启发式复查：阶段、版本和错误可见；应用与保存分离，支持撤销和丢弃；Graph 分支不会压成线性栈；外部包需本机信任；编译成功不冒充视觉通过。实测发现的色标按钮文字重叠已改为带名称与提示的时钟/菱形图标；色标数值行使用短标签，RGBA / 位置采用 0.01 调整步长。没有开展用户研究，不将启发式检查当作真实用户满意度结论。

## 性能与尚未实现的边界

- 原生径向渐变 1920×1080 像素计算经查表优化，本轮多次单次约 6.4–8.4ms，最终记录 8.4ms；这仅测像素算法，不是完整合成帧耗时或稳定帧率承诺。
- 自定义程序为主线程 CPU 解释执行。实际 1080p 有机纹理首次应用曾约 1.9s，复杂效果实时拖动/播放性能尚未达标。编译缓存、节点缓存和指令预算已实现，但不能替代后续 Worker / GPU 优化。
- 每次最多 4,194,304 像素、128,000,000 条标量运算；4K 自定义效果会拒绝执行并诊断。原生效果沿用原有分辨率能力。
- 统一定义支持多输入端口，已有 Merge Compositor / Solid Generator / Transform / Mask 已纳入兼容适配；第一代自定义程序只支持无输入 Generator 或单 Image Filter。texture 类型是协议预留；WGSL、外部纹理采样、非空依赖、多 Pass 与自定义多输入合成尚未实现。
- 缺失或不受信任的效果保留工程数据，可禁用、删除、信任有效内嵌包或添加替代效果；尚无自动寻找外部文件的 Relink 向导。
- Agent 已有完整公开工具及系统策略、图像反馈隐私门禁；未发送真实外部模型请求，不能承诺所有供应商都能可靠生成符合创作意图的程序。无识图证据时只能报告编译与像素诊断。
- 已通过桌面构建，未生成、签名或发布本轮安装包。

上述边界为明确未完成项。已交付的是可编辑、可动画、可保存重开的端到端程序化效果基础，不是实时 GPU 插件平台。

## 2026-10-09 后续性能优化

运行时按计算依赖复用帧/行/列结果，并采用固定操作码，保持像素结果和安全预算。后续完整回归为130文件、514测试通过；真实浏览器1080p纹理中位耗时约1792ms→95ms，输出逐像素一致。原先约1.9s的示例瓶颈已显著改善，仍未达到稳定30fps。详见 `EFFECT_RUNTIME_PERFORMANCE_RESULT.md`，本报告前述阶段门禁保留原始验收记录。

## 2026-10-09 / 0.9.18 边界补齐

原报告未验证的真实外部模型生成、交互实时预览与桌面交付已追加处理，见 EFFECT_BOUNDARIES_RESULT.md。代表性 1080p 纹理交互采样平均6.44ms，停止后与完整渲染及PNG导出逐像素一致；真实模型完成声明式生成、像素反馈与事务撤销/重做；最终519测试通过。仍不声称任意程序GPU实时、4K预算放宽或安装包经过商用签名/公证。
