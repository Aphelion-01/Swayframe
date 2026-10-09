# Swayframe 0.9.18 剩余边界完成记录

日期：2026-10-09。承接 V0.3 Unified Effect Engine 与 03760ce 性能优化，处理交互预览、真实外部模型验证和桌面交付。

## 交互预览

播放、属性拖动与时间拖动自动按运算量降低自定义像素效果采样，停止时间变化 120ms 后恢复完整质量。沿用现有 Timeline 预览条，明确显示采样倍率；未新增工具栏按钮、命令或 Scene 字段。完整帧缓存与交互采样分离。所有导出仍使用完整质量，错误包继续阻止导出。

真实浏览器 1920×1080 有机纹理：交互采样 1/4，十帧中的首帧 9.6ms，后九帧平均 6.44ms；完整质量恢复 82.6ms。恢复画面与独立完整渲染、PNG 导出均逐像素一致。证据 `outputs/effect-boundaries/browser.json`，可通过 `/outputs/effect-boundaries/benchmark.html` 按钮复查。

此结果是本机代表场景测量，不保证任意复杂场景的帧率；交互采样为近似画质，可能降低细节，停止后恢复。仍为同步 CPU 实现，不声称 GPU/Worker 实时执行；4K 自定义包仍受原像素与操作预算限制。

## 真实模型

使用桌面现有服务配置及安全存储中的凭据，只发送合成任务。修复完整 API 地址重复拼接，复杂桌面请求最长 120 秒；生成工具补齐指令与颜色语义，错误反馈明确指令索引、参数数量及非法引用。验证源码 `scripts/effect-forge-live.ts`（显式运行，不属于普通测试）。候选经历实际外部模型生成、严格校验、编译、真实像素检查、AgentTransaction 应用和 Undo/Redo；没有向正式库写入，未使用真实用户工程。

模型首次有效候选存在纯白、颜色混合顺序错误；这些没有作为视觉通过结果。失败候选和反馈被保留，最终结论以 `outputs/effect-boundaries/live-model-report.json` 和 `live-model.png` 为准。真实模型可能反复生成非法指令，调用成功不保证任意创意要求成功；错误不会绕过校验。

## UX 与架构检查

任务：CANVAS 交互中的实时反馈，F1、当前合成上下文；状态沿用 TIMELINE 既有预览条。没有新增能力入口，Feature Registry、库存及 canonical home 不变。四种尺寸 1280×720 / 1440×900 / 1920×1080 / 2560×1440 中预览条保持 18px，无横向溢出；截图与几何记录位于同一证据目录。启发式检查：状态可见、画质降级明确、停止恢复、导出一致、取消和 Undo 边界维持；无新永久按钮和 UI/Scene 混写。

## 质量与桌面交付

自动检查、平台打包、签名与发布结果见下方最终记录。macOS 沿用无 Developer ID/公证配置，Windows 沿用无 Authenticode 签名配置；不能将成功打包称为已签名或已公证。Windows 程序在 macOS 上仅验证安装包与归档，未声称 Windows 实机运行通过。

### 最终门禁与真实模型结果

131 个测试文件、519 项测试通过；lint、typecheck、Web build、desktop build通过，保留已有主包体积提示。真实编辑器播放状态实测显示“交互预览 · 1/4 采样 · 9.0ms”，停止后回到完整帧缓存。

配置模型 qwen3.8-27b 经真实服务生成并修正颜色混合后通过：空间变化、动画像素、颜色范围检查全部通过。最终包 SHA256 为 `3c91cf30be41c9946bef5db76b63bf400d42aa436a604a5cd62c532b6f4678b8`。提交前 Scene 未变、应用成功、Undo 与 Redo 成功，正式库未写入。人工检查最终 PNG 为蓝紫波纹，与早期纯白候选明确区分。该结果证明此代表性生成及反馈链路可执行，不声称所有模型、任意创作请求或无人监督视觉评分均可靠。

macOS Apple Silicon DMG 与 Windows x64 NSIS 安装包已构建。两个平台 app.asar SHA256 相同，内含 package.json 版本均为0.9.18，main.cjs与本次desktop-dist构建完全一致。macOS包实际启动至0.9.18欢迎页，独立测试目录新建工程、创建矩形、打开统一效果浏览器成功；未使用用户工程或用户偏好文件。Windows安装器MZ签名与内嵌归档检查通过，未做Windows实机运行。证据 `artifacts.json`、`native.png` 和打包日志。

DMG 经 hdiutil verify 检查通过；安装包 SHA256 见 `outputs/effect-boundaries/SHA256.txt`。发布版本使用独立0.9.18文件名，旧版安装器不被覆盖。
