# 第一阶段执行记录

2026-10-03（Asia/Shanghai）：任务书原件已收到并保存到 `docs/baseline/`，基线缺失阻塞已解除。原件保留，正文和 SHA-256 已记录。用户授权按 T0 → T10 连续独立实施。

## 阶段状态

T0～T10 PASS；A-01～A-10 全部通过。当前无未解决阻塞。

## 技术决策

采用任务书允许的本地 Web 与模块目录方案，见 ADR 0001。

## 开发记录

- T0：先创建工程质量契约测试；实现 React/Vite/TypeScript strict、ESLint、Prettier、Vitest、README、架构与阶段质量日志。
- Git 已初始化；T0 四项质量门禁 PASS（1 test），本地开发服务已启动并完成浏览器冒烟检查。见 `outputs/quality/T0.log`。

- T1 PASS：只读模型、UUID、四类图层工厂、默认合成；4 tests，四项门禁通过。

- T2 PASS：统一 Linear/Bezier/Spring 求值与参数校验，13 tests；四项门禁通过。单帧与区间外采用最近端点，Spring 解析响应按区间终点归一化。

- T3 PASS：共享数据命令、逆操作、原子 Transaction、历史、临时编辑提交/取消 API；19 tests，四项门禁通过。

- T4 PASS：严格 Zod schema、引用/ID/时间检查、版本分派、JSON round-trip 与错误类型；24 tests，四项门禁通过。

- T5 PASS：纯渲染快照/命中测试、Canvas2D Adapter、临时拖拽控制器；29 tests，四项门禁通过；真实浏览器拖拽检查无运行错误。

- T6 PASS：Layer Panel、Inspector、四类创建/图片导入、打开保存、localStorage 恢复；33 tests，四项门禁通过。

- T7 PASS：播放头、秒制循环时钟、四属性关键帧和三插值选择；36 tests，四项门禁通过。

- T8 PASS：严格 Tool schema、批量预验证、同一 Command/Transaction、固定 Mock Agent 入场演示与一次 Undo；41 tests，四项门禁通过。

- T9 PASS：Layout/Color/Motion Advisor 协议与确定性 Mock、Proposal schema、共享命令转换和原子应用；45 tests，四项门禁通过。

- T10 PASS：15 个测试文件、58 项测试通过，typecheck/lint/tests/build 全部通过；增加运行时 Transaction 校验、监听器异常隔离、UTF-8 文件大小保护、溢出插值保护、Escape 取消编辑和异步图片资源释放回归检查。修复画布按宽高共同适配，避免较矮窗口裁切。最终质量日志见 `outputs/quality/T10.log`。

## 验收状态与证据

浏览器验收使用 Browser Plugin 的实际可见 UI、原生文件选择器与下载，不通过测试后门写入 Scene。脚本为 `scripts/browser-acceptance.mjs`，运行记录为 `outputs/browser-acceptance.json`。核心与集成自动测试为 `tests/`。

| 编号 | 状态 | 核验结果 |
| --- | --- | --- |
| A-01 | PASS | 默认 1920×1080、30 fps、5s 新建，Rectangle 同步显示于 Layer/Canvas/Inspector/Timeline。 |
| A-02 | PASS | 真实拖动和数值缩放、旋转、透明度编辑；逐步撤销、重做恢复值。 |
| A-03 | PASS | 手动建立 0→1s Spring Position 与 Linear Opacity，播放头推进且插值可编辑。 |
| A-04 | PASS | 导入真实图片及四类图层后保存；完全关闭编辑器页签，重新打开并导入；再次下载 JSON 与原文件逐字一致，ID、顺序、属性、关键帧、内嵌资源保持。 |
| A-05 | PASS | 多次 pointermove 拖动只增加一笔历史；复杂 Agent 操作也是一笔历史。 |
| A-06 | PASS | 固定提示经 Tool→Command→Transaction 创建蓝色方块入场、过冲和淡入；生成后 Inspector/Timeline 可继续编辑。 |
| A-07 | PASS | 一次 Undo 移除整个 Agent 创建结果，原有图层保留；Redo 恢复。 |
| A-08 | PASS | 布局建议生成时不改变工程或历史；点击应用后居中；一次 Undo 恢复原位置。Color/Motion Mock 也有协议与转换测试。 |
| A-09 | PASS | 非法 JSON 与未知版本显示可读错误；工程和历史保持，浏览器无运行错误。 |
| A-10 | PASS | TypeScript AST/类型架构测试检查核心无 DOM/React/具体 Renderer 依赖；UI/Agent 无直接模型写入；只读冻结模型、严格事务校验及共享命令路径检查通过。 |

## 交付内容

源码包包括 src、tests、scripts、锁定依赖、配置、ARCHITECTURE.md、完整基线、开发与验收记录以及质量日志。`outputs/examples/` 提供真实 UI 导出的四图层工程和 Agent 蓝色方块入场工程。README 说明本地启动、编辑、动画、保存、Mock 和质量检查；`outputs/preview.png` 为实际界面截图。

## 范围与已知限制

AI 使用任务书允许的固定 Mock，不包含真实模型或联网服务。Image 静态解码，未实现媒体时间同步、视频导出和禁止的高级功能。浏览器自动保存受容量限制，显式 JSON 保存是交付工程的主路径。构建时 Zod 上游注释产生两条不影响构建的 Rollup 提示，构建退出码为 0。

原生 Blob 下载成功但 Browser Plugin 的 download 事件钩子未返回；验收使用限定文件名前缀与点击时间核验真实下载文件，并比较内容。未把钩子超时当作应用保存失败。

## 中文界面更新

2026-10-03：全部内置界面文案、属性/轨道/插值标签、默认工程与图层名、助手提示、时间单位及错误提示改为中文；Zod 使用中文校验消息。旧工程默认英文名仅在显示层映射为中文，文件内容与用户自定义名称不被改写。协议字段、API、文件格式和插值类型保持原样。58 项测试与 typecheck/lint/build 通过。

## 用户授权的基础编辑扩展

2026-10-03：完成用户确认的关键帧拖动/多选/复制粘贴、图层多选/复制/快捷键、画布缩放/平移、对齐分布和时间轴缩放；68 项测试及全部质量检查通过。扩展说明与浏览器实测见 BASIC_EDITOR_UPDATE.md。原 T0～T10 日志保留。
