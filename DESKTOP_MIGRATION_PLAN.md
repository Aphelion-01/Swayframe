# Swayframe 桌面化审计与实施基线

审计日期：2026-10-03。核心原则：Desktopize the existing editor. Do NOT rewrite the editor.

## 当前工程

工程使用 npm、React 19、TypeScript、Vite，入口为 `index.html → src/main.tsx → src/ui/App.tsx`。没有现成 Electron Shell 或独立 workspace 配置。现有业务位于 `src/core`、`src/ui`、`src/renderers`，保持原目录，不为匹配推荐 Monorepo 而移动文件。

Project/Scene 共用 `project-model.ts`；CommandSystem 负责 Transaction、逆命令和 Undo/Redo；EditorStore 负责编辑器瞬态状态及提交入口。Canvas 连续拖动通过 beginEdit 合并为一次历史操作。Timeline、Graph、MotionCurve、Inspector、Effects、2.5D 和 Agent 不需要复制或重写。桌面菜单只分发现有编辑动作，工程替换仍走现有 load/CommandSystem。

## 文件、素材与渲染现状

`project-io.ts` 已实现 JSON 大小限制、严格 schema 校验及 0.1/0.2 → 0.3 migration。Web 保存通过 Blob 下载 `.motion.json`，打开通过 File input；Web 自动保存使用 localStorage。桌面必须复用 serializer/loader，增加 `.swayframe` 文件和原生对话框，不建立第二套 Project Model。

Asset 当前是共享 ID + MIME + 内嵌 dataUrl。导入使用 FileReader/createImageBitmap，多个 Layer 可引用同一 Asset。桌面需要在原 Asset 上增加可选 Linked Reference，保留旧内嵌资产兼容，并通过受控资源协议读取原生文件。失联素材应保留 ID 和 Layer，Relink 通过 Command System 修改引用。

Canvas2DRenderer 使用浏览器 Canvas、fetch、createImageBitmap；PNG 导出复用当前 Renderer 和异步逐帧导出，不迁移 Main Process。Main 只做异步磁盘写入，NativeCore/MediaService 仅建立未来接口。

## 新增模块与安全边界

新增 `apps/desktop/electron` 的 main/preload/ipc/platform/menu/windows，以及 `src/desktop` 的平台无关 contracts、DesktopService、WebAdapter/ElectronAdapter、工程生命周期及启动界面。打包脚本沿用 npm。React 不导入 Node/Electron，不知道 IPC channel。

Electron 开启 contextIsolation，关闭 nodeIntegration，沙箱 preload 只暴露有类型的窄接口；IPC 校验请求、可信 sender 和文件授权；原生文件路径只能来自系统对话框、OS 拖入文件或已打开工程的引用。资源协议只访问已批准素材，拒绝目录遍历。正式工程和 recovery 分离，写入先临时文件再原子替换，失败不清除 dirty。

## 风险与控制

1. 原生文件、菜单与 Toolbar 重复逻辑：统一 ProjectService 和现有 Editor Action。
2. Web 回退：保留 WebAdapter 与原开发入口，现有测试持续执行。
3. Linked Asset：扩展既有 schema/migration，覆盖旧文件、missing、relink、共享引用与 round-trip。
4. 关闭与保存竞争：序列化生命周期请求，Cancel 保留窗口，保存失败阻止关闭；保存中继续编辑不得错误清除 dirty。
5. 恢复和布局：仅 committed Scene 触发 debounce recovery；窗口、面板参数写 User Preferences，不进入 Scene。
6. 多显示器：恢复窗口前检查可见屏幕，离屏位置重置。
7. 跨平台：平台快捷键集中映射；Unicode/空格路径测试；macOS 实机验证，Windows 无实机不得记 PASS。
8. 品牌资源：仓库未找到已确认 Logo，已询问文件路径，暂不设计替代品牌。

## 按顺序执行与验收

D0 审计 → D1 Shell → D2 安全 DesktopAPI → D3 原生工程 → D4 生命周期 → D5 素材 → D6 菜单/窗口/工作区 → D7 Recent/Autosave/Recovery → D8 导出 → D9 打包 → D10 QA。

每阶段记录质量门禁：lint、typecheck、全部 unit/integration tests、Web build、desktop build。D0 尚未引入 Shell，desktop build 为不适用；D1 起必须执行。保持现有 40 个测试文件、120 项基线，新增桌面合同、IO、恢复、路径、IPC、窗口及 migration 测试。最终 CASE 01–12 分别记录已验证、失败或环境未验证，不把配置完成等同实际平台验收。

安全配置依据：[Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)、[Electron Sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox/)。

## 实施结果

D0～D9 的实现与自动门禁完成；D10 自动门禁及 macOS 核心原生 QA 完成，Windows 实机和部分 OS 工作流未验证。最终 49 个测试文件 / 141 项通过，安装包与逐 CASE 证据见 DESKTOP_ACCEPTANCE.md。缺少已确认 Logo 不擅自重新设计。
