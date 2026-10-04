# 架构入口

完整规范见 `docs/ARCHITECTURE.md`。当前执行基线为 `docs/baseline/TRANSFORM_READABILITY.txt`，按 TP-0→TP-8→VR-0→VR-8 完成轴向、支点与图层/属性可读性。GUI与Agent仍共享Command System，业务修改通过Transaction；之前基线保留用于追溯。

GUI 与 Agent 共用 Command System；复杂操作走 Transaction；Intelligence 仅输出 Proposal。Electron Shell 只增加文件、窗口、菜单、持久化和平台服务，React 与核心不导入 Node/Electron。

审计见 `DESKTOP_MIGRATION_PLAN.md`，交付、验证与限制见 `DESKTOP_ACCEPTANCE.md`、`DESKTOP_KNOWN_LIMITATIONS.md`。

当前新增执行基线为 `docs/baseline/COMPOSITING_GRAPH_CG0_CG12.txt`，CG-0→CG-12 已完成。`Layer.editor.graph` 是唯一效果数据源，效果栈从线性图派生。设计见 `COMPOSITING_GRAPH_DESIGN.md`，验证见 `COMPOSITING_GRAPH_ACCEPTANCE.md`。后续自主冲刺按 `docs/baseline/DEV_SPRINT_V2.txt` 推进，不改写既有核心。


当前UI执行基线为 `docs/baseline/FULL_UI_REDESIGN.txt`，0.7.0已完成三轮改造。设计tokens、共享图标/焦点/键盘组件及工作区偏好边界见 `docs/ARCHITECTURE.md`；审查与验证见 `docs/ui-redesign/RESULT.md`。Project schema仍为0.5.0。
