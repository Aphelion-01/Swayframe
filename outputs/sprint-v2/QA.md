# Swayframe 0.6.1 最终桌面 QA

2026-10-04，macOS arm64。基于最终 release/mac-arm64/Swayframe.app 复制独立验收应用，只调整验收 bundle identifier；使用独立 userData，避免影响已有用户工程。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 严格迁移与完整工程 round-trip | PASS：2 合成/11 图层、内嵌素材、父级、预合成、遮罩、节点动画、2.5D | full-workflow-evidence.json / full-workflow.swayframe |
| 原生打开与 0.5s 预览 | PASS：素材和动画效果真实显示 | native-full-workflow.jpg / native-midframe.jpg |
| 多行 Enter 与 Cmd+Enter | PASS：临时输入不新增历史，提交后一次 Undo | native-save-evidence.json |
| Undo / Redo / 原生保存 | PASS：恢复原文字再重做；磁盘只变更标题文字.text | native-save-evidence.json / native-full-workflow.swayframe |
| 退出重开 | PASS：文字保留，历史清空，其余工程数据一致 | native-reopened.jpg / native-reopened-midframe.jpg |
| PNG 当前帧 | PASS：1920×1080，t=0.5s，无选择框 | native-frame.png |
| 原生 PNG 序列 | PASS：3 帧，30fps，0.5～0.6s；首帧与单帧完全一致，后续帧改变 | native-export-evidence.json / native-sequence/ |
| 两平台包构建 | PASS：macOS arm64 DMG / Windows x64 NSIS | ../quality/sprint-v2-package-mac.log / sprint-v2-package-win.log |

GUI 文字录入的实际结果为 `wayframe\nDesktop QA V2`；保存重开按实际输入核对。独立 QA 副本不作为创作模板，中文模板保留在 full-workflow.swayframe。八方向手柄在桌面截图可见；其几何、取消和提交行为由自动交互测试覆盖。本轮未逐项手工重测全部历史功能，Windows 无实机。

构建包哈希见 release-evidence.json，最终全门禁见 ../quality/V2-10.log。所有图片、JSON 和 PNG 均为实际运行输出，未生成替代验收画面。
