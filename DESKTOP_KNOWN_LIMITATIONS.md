# 桌面 Beta 已知限制

本版为 0.5.0 / desktop-beta-1。核心编辑器保留，交付是可运行桌面 Beta，尚不能声明跨平台正式发布验收全部通过。

- 第一版 Swayframe Logo 未在仓库找到，也未收到资源路径。未重新设计 Logo；当前安装包使用 Electron 默认图标。提供已确认资源后放入 ProductMetadata 的 build/icons/icon.png、icon.icns、icon.ico，再重打包。
- 没有 Apple Developer / Windows 签名证书。macOS 未签名、未公证；Windows 未 Authenticode 签名。macOS 包为 Apple Silicon arm64，Windows 包为 x64。
- Windows NSIS 交叉打包成功，已配置安装目录、卸载、快捷方式与 .swayframe 文件关联；没有 Windows 实机，安装、启动、卸载、DPI/GPU、多显示器和同工程跨 OS 对照尚未验证。
- macOS 通过可运行 .app 的实测，不等于已完成签名公证发行、拖至 Applications 后所有系统权限与 Finder 关联场景。OS Finder 跨窗口拖放仍需补充稳定的真实操作证据；现有导入和共享命令路径有测试与原生对话框验证。
- Linked Asset 保存本机绝对路径，不打包素材。将工程转移另一台机器后，应重新链接素材；旧内嵌图片仍能读取。图片限制 10 MB，工程 20 MB；GIF 保持既有静态显示。
- PNG 序列继续既有帧数/内存限制：最多 3000 帧或 512 MB，建议分段。逐帧渲染在 Renderer，ZIP/CRC 与序列落盘在 Worker。未新增 FFmpeg、MP4、GPU Renderer、Rust NativeCore 或实际 AI。
- 生产依赖审计为 0 项漏洞。构建工具依赖树有 http-cache-semantics 通告（npm audit 开发树 8 项 high）；registry 未提供公告建议的修复版本，未强制降级或虚构修复，发布前继续复核。

当前没有阻止 macOS Beta 本地调试的外部依赖。Logo、签名与 Windows 环境是完整发行验收缺口。


## 0.6.1 增量状态（2026-10-04）

当前产品为 0.6.1 / autonomous-sprint-v2，schema 0.5.0。上文 0.5 为历史验收边界；本次修复内嵌图片在严格 CSP 下解码和独立 userData 单实例锁顺序，增加完整节点/遮罩/父级/预合成/2.5D 工程的原生保存重开与 PNG 像素对照。最终 71 文件 / 186 tests；原始证据见 outputs/sprint-v2/QA.md。macOS 和 Windows 安装包已更新。签名、Logo、Windows 实机等发行缺口仍存在，未以交叉打包替代实机验证。
