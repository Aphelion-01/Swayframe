# Swayframe Desktop 0.5 验收

2026-10-03，macOS Apple Silicon。本版已达到可运行、可打包、本地调试的桌面 Beta；因 Logo、签名和 Windows 实机环境缺口，不声明完整跨平台发行验收。

## 后续更新

2026-10-03 新增 X/Y 默认链接与按钮；最新为 50 个测试文件 / 145 项通过，安装包已同步更新。本节以下保留首次桌面验收记录，新增证据见 `outputs/AXIS_LINK_ACCEPTANCE.md`。

## 交付

- `release/mac-arm64/Swayframe.app`：实际运行测试的 macOS arm64 应用。
- `release/Swayframe-0.5.0-arm64.dmg`：未签名安装镜像。
- `release/Swayframe Setup 0.5.0.exe`：未签名 Windows x64 NSIS 安装器；生成成功，实际安装/运行待 Windows 验证。
- `outputs/desktop-qa/verification.json`：文件、真实检查结论和安装包 SHA256。
- `outputs/desktop-qa/desktop-final.jpg`：最终包重开工程的截图。
- `outputs/desktop-qa/中文 空格 🌙.swayframe`：Shape、Text、位置关键帧和共享 linked image 测试工程。

开发：`npm run desktop:dev`，单命令启动 Vite 与 Electron；Web 仍为 `npm run dev`。构建：`npm run desktop:build`；打包：`npm run package:mac` / `npm run package:win`。默认产品 UserData 为系统 Swayframe 目录，开发版及 QA 独立目录不混用。

## D0→D10

| 阶段 | 实施与证据 |
| --- | --- |
| D0 | 编码前审计，`DESKTOP_MIGRATION_PLAN.md`；120 项 Web 基线通过，desktop build 不适用。 |
| D1 | Electron Shell 直接加载既有 Editor，Web 构建继续有效。 |
| D2 | 有类型的窄 preload / IPC、可信 sender、路径授权、沙箱和 CSP。 |
| D3 | 原生 New/Open/Save/SaveAs、`.swayframe`、Unicode 路径与旧格式迁移。 |
| D4 | dirty、原子保存、并发保存、防丢失保护；失败不清 dirty。 |
| D5 | 链接素材、系统对话框和文件拖放接入、共享 ID、missing/relink 命令。 |
| D6 | 原生菜单、平台快捷键、窗口边界、布局与最后 tab 偏好。 |
| D7 | 最近工程、缺失项移除、debounce Recovery、启动恢复和分类日志。 |
| D8 | 原生 PNG 文件与序列目录，复用 Renderer，归档与落盘 Worker。 |
| D9 | macOS .app/.dmg 和 Windows NSIS .exe 生成成功；缺品牌图标和签名。 |
| D10 | 最终 49 个文件 / 141 项测试、lint、typecheck、Web build、desktop build 全通过；macOS 实测如下，跨平台 QA 保留未验证项。 |

各阶段门禁原始记录为 `outputs/quality/D0.log`～`D10.log`。阶段门禁是自动验证，不等同各平台原生运行验收。保留既有 120 项测试，新增 21 项覆盖生命周期、保存竞争、授权/合同、真实磁盘写入、图片签名、窗口、旧格式、恢复和导出安全。D10 修复全部纳入最终安装包。

## CASE 01～12

| CASE | 结论 | 实际证据与边界 |
| --- | --- | --- |
| 01 | macOS 应用启动通过；双击安装后启动待补 | 最终 `.app` 原生窗口运行，无浏览器地址栏，直接加载已有编辑器。CLI 工程参数相对路径也已实测。 |
| 02 | 通过 | 原生新建，创建 Shape/Text，位置 0→1 秒两帧动画，Save As 到中文、空格、emoji 文件名。 |
| 03 | 通过 | 关闭重开、最近工程与最终包重开均恢复；形状、文字、动画和素材 ID 保留。 |
| 04 | 通过 | Cmd+Q 出现 Save/Don't Save/Cancel；Cancel 保持窗口和 dirty。保存后关闭写入窗口偏好。 |
| 05 | 功能已接入；真实 OS 拖放未确认 | Canvas/Timeline/Assets 有原生 File→preload 路径授权→同一导入 Transaction。原生对话框导入成功；Finder 跨窗口自动操作未取得新增图层证据，不能记实测 PASS。 |
| 06 | 通过 | 移动测试源图片后重开显示“素材失联”；原生 Relink 选择 relinked.png 后恢复。保存文件验证素材 ID 未变、图层保留；共享引用和 Undo 有独立测试。失联显示占位，不阻断其他图层。 |
| 07 | 通过 | Cmd+D 后 Undo/Redo 图层数 3→4→3→4，命令历史与 Web 共用。 |
| 08 | 已做核心交互回归 | Timeline 0→1 秒关键帧；Graph 打开并应用缓动后撤销；Motion Curve X1 输入 0.2 提交一笔历史；画布真实拖动一笔 Undo。全部原有自动测试继续通过；不据此宣称所有组合都已穷举。 |
| 09 | 通过 | dirty 快照 4 层、正式文件 3 层；强制结束测试应用后重启显示恢复对话框，Recover 得到 4 层，保存清除 recovery；正式文件未被恢复机制覆盖。 |
| 10 | 打包通过；安装/运行未验证 | Windows x64 NSIS 输出成功，资源 ProductName/Version、安装目录、快捷方式、卸载和文件关联已配置；没有 Windows 实机。 |
| 11 | 原生运行通过；完整安装流程待补 | macOS `.app` 实际启动、新建、原生保存与重开通过，DMG 成功生成；未做签名、公证和 Applications 安装后的全部流程。 |
| 12 | 未做双 OS 实测 | 使用单一 serializer/schema 和 Windows/macOS 路径测试，无 Windows 环境做同文件实际对照。外部素材跨机移动须 Relink。 |

额外实测：当前帧导出为 1920×1080 PNG；0→0.1 秒、30 fps 序列输出 3 帧与 manifest，文件签名/帧数检查通过。桌面数字字段的 Select All 走原生文本编辑 API。

未验证项和资源缺口见 `DESKTOP_KNOWN_LIMITATIONS.md`。Windows 安装、双 OS 工程对照、稳定真实 Finder/Explorer 拖放、首版 Logo 接入和签名发行是下一轮验收所需条件。
