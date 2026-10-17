# V2-6 Feature Placement and UI Review

对象为隔离 Agent 任务与草稿；Inspect/Automate、F5、AssistantMode、ASSISTANT、canonical assistant.actions。复用 agent-v2-test scoped Command 与 typed contribution，内部参数控件无新增永久入口，工具栏增量0。UI 状态不写 Scene，接受仍共享 AgentTransaction。

P1：恢复成功仍展示历史错误 alert，已改为只显示 terminal error。P1：失败前缀现在允许明确标记的只读检查，接受禁用，UNSAFE 草稿不能伪装成完成。P2：增加完成数和恢复结果；原输入保留，开发者细节默认折叠。诊断传入整个 session 导致循环序列化的初次失败，已修复为明确字段投影，测试覆盖额外私有属性不导出。

实际 Electron 四尺寸1280×720、1440×900、1920×1080、2560×1440检查通过；1280失败草稿可滚动查看预览与细节，无横向溢出或按钮重叠。第二轮检查对齐、密度、字号、控件和分隔线；第三轮检查稳定专业工作流、画布主位和克制表面。采用 DESIGN.md 现有规则，沿用 Modal 焦点和 Esc，没有添加卡片主题或功能域。

React UI 测试覆盖明确启用、失败保留输入、恢复后清理 alert、一次接受/Undo/Redo和只读失败前缀。截图 fixture 的 createText.fill 被严格 Schema 拒绝，已改为注册的 color 并增加 fixture 预检；失败记录保留，产品契约未放宽。内部 heuristic 和截图不等于真人可用性研究。
