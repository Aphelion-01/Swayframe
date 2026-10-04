# Full UI/UX Redesign Audit

基线：0.6.3 / db7c0a7。真实界面检查：1280×720，曲线系统验收工程。目标：桌面创作软件，而非网页卡片。官方 frontend-skill：list接口403；Git核查openai/skills当前完整树无该Skill，指定安装路径不存在。使用本仓库 professional-creative-editor-ui 规则继续，无冒称官方安装成功。

## Architecture Map

React 19 + TypeScript + Vite / Electron；无Tailwind或路由。Web入口main.tsx，桌面入口DesktopApp。App以Toolbar+Workspace+statusbar组成；左Project/Layer/Assets，中央Canvas，右Inspector/NodeInspector，下Timeline/GraphEditor/CompositingGraph。DesktopApp另有启动/最近工程、恢复、About。Toolbar拥有工程菜单、合成设置、Export、CommandPalette；MotionCurve/Path/内部合成编辑器为已有附属编辑界面。单个base.css多阶段追加，compositing-graph.css独立；现有少量tokens但早期硬编码依旧覆盖。共用primitives、fields、layout、tools；Command/Transaction、渲染/动画核心保持。

## Initial Audit

| 优先级 | 真实发现 / 源码佐证 | 实施方向 |
|---|---|---|
| P0 | 1280×720可用但窗口/面板尺寸上限会挤压主画布；分隔线提交依赖React旧layout | 有界布局、尺寸收尾同步、可恢复偏好、键盘resize |
| P1 | 图层/属性仍呈旧蓝黑，中央neutral，节点另一套色系；大量旧hex覆盖 | 单一语义token体系，清理旧颜色和死品牌CSS |
| P1 | 绘图工具混用emoji/字符，吸附与钢笔同字符 | 16px矢量Icon系统，统一工具/播放/显隐/锁定 |
| P1 | 面板切换悬在属性标题上方；画布caption工具分散 | 稳定工作区栏，viewport控制分组，元数据降权 |
| P1 | AI在左侧底部折叠区，展开后与图层争空间 | 左侧独立助手Tab，执行与Proposal仍现有逻辑 |
| P1 | Inspector scalar重复标签，vector竖向标签挤占高度 | compact property rows，保持aria标签、链接/关键帧/预览 |
| P1 | 时间轴tab选择弱、时长条强蓝、行分隔杂乱 | 一致Tab选中、弱化时长条、清晰ruler/diamond/playhead |
| P1 | 节点大圆角/阴影、饱和蓝底、分类与连线层级不清 | neutral nodes，小圆角、分类线/ports、统一selection |
| P2 | Tabs缺Arrow/Home/End键盘切换；菜单与dialog焦点/关闭不统一 | 共用焦点/取消行为与keyboard tabs |
| P2 | Assets长名缺tooltip；空/加载/错误文字与主控同权重 | 清晰list、full-name tooltip、下一步empty feedback |
| P2 | 启动屏40px标题、大按钮；和编辑器视觉断层 | compact project-launcher，与同一tokens/dialog系统 |
| P3 | 零散spacing、图标尺寸、弱文字对比和重复边框 | 第二轮Visual Polish与第三轮professional-feel检查 |

## Validation Plan

每批实际运行截图/交互。覆盖1280×720、1440×900、1920×1080、2560×1440及窄窗口；图层/素材/助手、变换/实时数值、时间轴key、曲线、节点、命令菜单/设置/导出。相关回归后完整lint/typecheck/tests/Web+desktop build。截图、已测/未测限制记录在RESULT.md。

## Closed Audit / 0.7.0

初审P0布局提交/边界和P1色系/图标/区域组织已落实。第二轮修正图层实际行高、属性轴标签、曲线SVG伸缩和旧样式覆盖；第三轮修正隐藏空状态、助手切换丢草稿，并检查稳定shell/画布权重/工具密度。三批门禁分别208/209/209 tests，通过Web与desktop build。五种真实编辑器窗口截图及最终原生保存重开/导出字节对照完成。

详细标准对照、截图索引、Skill安装例外和Windows/签名验证边界见 `RESULT.md`，结构化证据见 `outputs/ui-redesign/verification.json`。长期重度用户可用性和跨平台DPI不作为作者视觉审查的已完成结论。
