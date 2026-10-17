Swayframe 0.9.18 补齐 V0.3 Unified Effect Engine 的交互预览与桌面交付。

- 自定义效果播放、参数拖动及时间拖动按运算量自动降低采样，停止后恢复完整画质；预览条明确显示状态，导出始终使用完整质量。
- 修复完整 OpenAI-compatible API 地址重复拼接，改进声明式生成工具的规则与校验反馈。现有真实模型已完成生成、像素反馈、AgentTransaction、Undo/Redo 的合成场景验收。
- 131 个测试文件、519 项测试通过；lint/typecheck/Web build/desktop build通过。1080p代表纹理1/4采样平均6.44ms；停止后与完整渲染及PNG导出逐像素一致。
- macOS Apple Silicon DMG 已实际启动检查；Windows x64 NSIS 已完成打包与归档检查，未做 Windows 实机运行。

macOS/Windows 安装包均未使用商用代码签名，macOS 未公证。CPU自定义效果仍有像素与运算预算；交互采样是近似预览，不承诺任意复杂场景实时。视频编码支持仍依设备而异。

安装：macOS 下载 .dmg；Windows 下载 Setup .exe。SHA256校验和见同名附件。源码、架构与验收证据见版本标签和 EFFECT_BOUNDARIES_RESULT.md。
