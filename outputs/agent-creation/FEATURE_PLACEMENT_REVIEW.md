# Feature Placement Review / UX Check

对象：GraphNode / 当前 Composition；任务：Automate；频率：F3 节点局部、F4 合成生成；上下文：GraphSelection / Composition。固定域：ASSISTANT。

node.ai 主入口 panel.inspector.effects，低频复用 context.node；branch.ai / graph.ai 主入口 context.node。复用现有 EditorCommands 和 useCommandScope 贡献，业务回调未进入 Feature Registry；全局占位绑定禁用，节点 Inspector 独立覆盖 node.ai 绑定，GraphWorkspace 覆盖 branch.ai / graph.ai 绑定。未改全局 Toolbar / Shell。

UX 检查：默认安全范围清楚；扩围显示实际节点；预览、接受、拒绝有分离状态；失败输入保留；关闭/Escape、Tab 焦点循环与返回复用 Modal。新对话框已修复缺少面板容器的问题。四种视口 1280×720、1440×900、1920×1080、2560×1440 的640px对话框全部在可视边界内，scrollWidth=clientWidth=638，无横向溢出。截图与 ui-geometry.json 可查。

验收场景由真实命令创建，不注入浏览器运行时状态，不修改用户正在编辑的工程。实际 Renderer 显示原生渐变/声明式纹理/Glow；节点参数仍可手动编辑。多尺寸截图验证入口和窗口布局，不证明真实 Provider 的开放规划成功。

桌面 dir 包已构建，独立profile启动尝试后电脑锁屏；原生窗口操作未验收，不计作PASS。
