# Reference Reconstruction Test — 0.9.23

| Benchmark | 当前结果 | 证据/边界 |
| --- | --- | --- |
| A createText | 本地通过 | 真实 AgentTransaction / Registry；字体、位置、颜色、对齐、中文、Undo/Redo、保存重载；Electron实际PNG有913个非背景像素 |
| B Cubic重建 | 真实运行，未通过 | DeepSeek/deepseek-flash已读取授权参考图，最终计划执行并完成初次及2次修正渲染；透视面、渐变、装饰位置仍有明显差异，视觉门禁阻止提交 |
| C 局部视觉修正 | 未完成独立验收，未通过 | 原范围门禁/保留文字/Undo回归仍通过；不能冒充已完成Cubic实图修正 |
| D 参数恢复 | 本地通过 | 真实Adapter预检失败，模型测试夹具修正一次后成功；并非真实LLM的恢复验收 |
| E Honest failure | 本地通过 | 缺像素、未知工具、无效/截断媒介、无变化修正会失败；B/C保留未通过状态 |

用户已明确全部授权参考图、独立工程渲染图及测试上下文外发；自动审批批准后真实运行 DeepSeek / deepseek-flash / https://api.deepseek.com。凭据仅由既有安全存储服务读取，没有输出密钥。多个真实运行发现的流程缺陷已修复，见 AGENT_TOOL_FAILURE_AUDIT.md。

本地媒体回归：真实FLAC 1秒、导入/混音导出1秒、保存重载、撤销；真实PCM AIFF 1秒、独立解码和HTMLAudioElement PCM预览1秒。报告在 outputs/agent-reliability-023/offline-report.json，其中realProvider=false明确为离线结果；live-report.json为最后一次真实Provider结果。

可复现本地程序：work/agent-reliability-023/main.ts + renderer.ts，打包生成main.cjs/renderer.js后用Electron --offline运行。网络测试已在用户全部授权后执行。程序只使用独立工程，无用户作品修改，库写入关闭。

0.9.24质量门禁：142文件、561测试通过，lint/typecheck/Web与桌面构建通过。真实运行证据在 outputs/agent-reliability-024/；render-0.png、render-1.png、render-2.png 分别为初次及两轮修正，均非人工重绘，均不计为复刻成功。

## 0.9.26 本轮验证边界
本地实际 Electron 验证见 `outputs/agent-reliability-026/live-report.json`（realProvider=false）及 `native-fill.png`，覆盖原生路径渐变、文字适配器、FLAC 与 AIFF。此前真实 0.9.24 Benchmark B 未通过，C 未完成。
本轮真实重跑在启动前被自动审批拒绝，原因是此前图片外发授权未明确写明 DeepSeek 目的地。已请求具体服务授权；未绕过审批，未用离线固定画面代替真实模型重建。B/C 不得升级为通过。
