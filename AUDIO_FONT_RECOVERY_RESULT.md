# Swayframe 0.9.29 — 音频播放与系统字体修复

## 根因与修复

截图错误来自播放阶段，不能据此归因 FLAC 编码不支持。对用户本地 MP3 和 `08.郊眠寺.flac` 做了隔离 Electron 复现：Web Audio 解码成功，但原 CSP 的 default-src 禁止 swayframe-asset / blob / data 媒体地址。仅补 media-src 后，blob 可加载，本地协议仍报媒体错误 4。启用协议 stream 后原链接可加载；进一步实测发现时间跳转不能生效，因为协议未提供字节范围响应。现已补齐本地媒体 CSP、stream 权限、Accept-Ranges、Content-Length、206 / Content-Range 和非法范围 416；没有开放远程来源。

原始素材不转码、不覆盖、不外发。AIFF 沿用现有 PCM 预览代理，Scene 和工程格式不变。导入仍为 asset.add / layer.create Transaction，预览仍由唯一编辑器时间驱动。

## 系统字体

文字属性中的原字体入口读取系统已安装字体名称，可输入筛选并预览。macOS 使用 NSFontManager，Windows 使用 InstalledFontCollection，Linux 使用 fontconfig。无参严格 IPC、固定命令、15 秒超时、2 MB 输出预算、去重/名称校验、1 分钟缓存。字体二进制不复制至工程；UI 状态不进入 Scene。提交沿用 layer.patch，Esc 和 Undo/Redo 保留；浏览器模式继续允许手动输入，自动系统列表属于桌面版。

## 实际验证

- `outputs/audio-font-029/before.json`：两份用户文件解码成功，原链接和 blob 播放均被地址安全检查拒绝。
- `probe-0.json`：仅 media-src 修复后 blob 加载成功，本地协议仍失败。
- `probe-1.json`：media-src + stream 后链接和 blob 均加载成功。
- `integration-user.json`：真实 NativeServices / IPC / preload、linkedAsset、共享 Transaction、MediaPlayback；用户 MP3 / FLAC 和 AIFF 的导入、播放、跳转、暂停、Undo/Redo 均通过。测试音轨静音，验证播放状态与实际媒体时钟推进，不声称人工听音。
- 同一次桌面验证读取 249 个字体，系统字体出现在原文字属性的可筛选选项中；选择 PingFang SC、Undo/Redo 通过。
- 字节范围边界、字体 IPC 拒绝注入、字体解析、UI 筛选与实时预览 / 提交 / 取消、Feature Registry 和 CSP 回归测试已纳入测试集。

## Feature Placement / UX

按 DESIGN.md 与 FEATURE_LOCATION_MATRIX.md，复用 INSPECTOR / panel.inspector.text 注册 text Section，不增加全局按钮。沿用紧凑参数行和语义 token；可见读取状态、名称筛选、手动输入回退。播放错误不再错误要求用户把已支持的 MP3 转成 MP3。现有媒体导入入口及 Scene/Transaction 边界保持不变。

## 平台边界

macOS 的真实本机字体与媒体链路已验证。Windows 固定字体查询与安装包由交叉构建生成，未在 Windows 原生系统验证；安装包未签名。旧版本文件和源工作区未清理或覆盖。完整质量门禁与安装包记录见 outputs/audio-font-029。

复现入口：先运行 `npm run desktop:build`，再运行 `node scripts/desktop/audio-font-smoke.mjs`；默认使用仓库 FLAC / AIFF 样本。设置 `SF_AUDIO_FILES_JSON` 为本机音频路径的 JSON 数组可复测 MP3 或用户文件，不上传音频。完整门禁：619 项测试、lint、typecheck、desktop:build 均通过。

Mac arm64 DMG 和 Windows x64 NSIS 已生成，尺寸和 SHA-256 见 `installers.json` 与 release 校验文件。Mac 打包应用的主进程、preload 和编辑器 DOM 启动检查通过；一次截图捕获失败（UnknownVizError），已与启动结论分开记录，字体区域的独立实际桌面截图见 fonts.png。Windows 使用已缓存的同版本官方 Electron 44.5.1 zip 完成交叉构建，未作原生 Windows 启动验收。
