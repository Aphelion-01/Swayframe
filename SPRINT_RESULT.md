# Swayframe Sprint Result

2026-10-04 · Swayframe 0.6.1 / autonomous-sprint-v2 · Project schema 0.5.0

先完成 Compositing Graph CG-0→CG-12，再完成 V2-1～V2-10。每个功能块单独跑质量门禁并保存 checkpoint。本轮止于完整桌面创作流程的验证与发布包收尾，后续优先任务如下；没有等待用户确认的开发阻塞。

## Shipped

- Compositing Graph：节点/端口/连线、验证与编译、Source/Output/Transform/Solid/Mask/Merge、颜色与模糊、参数动画、效果栈适配、缓存及 Agent 工具。
- Canvas：边缘/中心吸附与参考线、八方向二维缩放、X/Y 链接、固定对边、Alt 锚点缩放、Shift 方向/比例/旋转约束。
- Timeline：多关键帧整体范围限制与吸附、图层时间条范围约束、取消拖动恢复；沿用原多选、复制粘贴和菱形关键帧。
- Text：多行内容、双击聚焦、Enter 换行、Cmd/Ctrl+Enter 提交、Escape 取消、输入法保护。
- Value/Speed Graph：鼠标中心滚轮缩放、Space/中键平移、适应视图，缩放后准确编辑切线。
- 可打开的完整工程：2 个合成、11 个图层、素材、父级、预合成、遮罩、节点动画、曲线、3 个三维平面和摄像机。见 [验收工程](outputs/sprint-v2/full-workflow.swayframe)。

## Fixed

修复连续交互在播放头或工程切换后错误提交、失焦/捕获丢失残留预览、关键帧整体越界、时间条翻转、父级下负缩放符号丢失、曲线缩放后的切线坐标误差和预览轴域抖动。文字编辑及中文选字期间屏蔽编辑器快捷键。CG 阶段另修复桌面内嵌图片解码、独立配置的单实例锁顺序、故障回退污染缓存与旧效果迁移。

## UX Improvements

操作以画布和时间轴为主入口；参考线为瞬态，取消不写工程。二维手柄按屏幕像素显示，图层属性链接状态直接控制缩放。文字和曲线快捷键按上下文分离。连续场景提交保持一条 Command/Transaction：100 次预览只产生一次 Undo。

## Performance Improvements

父级查找复用 ID 索引，三维矩阵只计算三维层及祖先，同一帧复用摄像机。500 图层、50000 关键帧的 CPU 求值中位数：平面场景 2.165→0.162 ms/帧，父级场景 1.853→0.222 ms/帧，输出校验值一致。约 13.40 / 8.36 倍加速，仅为核心 CPU 求值，不能等同实际预览帧率。

默认不透明、正常混合、Source→Output 图层直接绘制，减少离屏表面分配。半透明、混合、遮罩和效果保留组渲染语义。见 [基准及复现说明](outputs/performance/README.md)。

## Desktop Progress

重新构建 [macOS arm64 DMG](release/Swayframe-0.6.1-arm64.dmg) 和 [Windows x64 NSIS](release/Swayframe%20Setup%200.6.1.exe)。本机使用最终 .app 的独立配置副本，实测打开完整工程、0.5s 动画预览、文字提交/一次撤销/重做、原生保存、退出和重开。磁盘对比确认只有指定文字内容改变，素材/父级/预合成/节点/关键帧/三维数据全部保留。

原生导出当前帧及 0.5～0.6s 的三帧序列：1920×1080、30fps；单帧与序列首帧像素完全一致，末帧确实随动画变化。证据、截图和输出见 [桌面 QA](outputs/sprint-v2/QA.md)。Windows 仅交叉打包，没有实机结果。

## Graph Integration

Graph 是唯一效果持久化源，Effect Stack 只是可表达的线性视图。图参数使用原 Property/Keyframe/MotionCurve 求值；GUI 与 Agent 共用 Command System，复杂批量操作用 Transaction。Intelligence Service 只输出 Proposal。保存 schema 0.5.0，旧 0.1～0.4 工程经严格迁移；没有引入第二套 Graph、动画或 Electron 业务系统。

## Tests

CG 完成时 62 文件 / 165 tests；V2 最终 71 文件 / 186 tests。覆盖交互取消与过期、100 次预览一次历史、吸附、越界、缩放几何与负缩放、IME、切线坐标、父级/三维闭包、离屏语义，以及原命令、事务、动画、图编译、迁移、保存和桌面核心测试。

最终门禁见 [V2-10.log](outputs/quality/V2-10.log)：typecheck、lint、186 tests、Web build、desktop build 全部 PASS。打包日志见 outputs/quality/sprint-v2-package-mac.log 和 sprint-v2-package-win.log。自动测试、浏览器验证和原生实测分别记录；未将每个自动场景都宣称为手工 GUI 验收。

Git 分支 codex/autonomous-sprint-v2。功能 checkpoints：f90e1e4、56a07f2、006fa29、8ef3547、adb4b78、8a7fd75；最终发布/验收记录另存收尾 commit。

## Known Limitations

- 安装包未签名/公证，沿用默认 Electron 图标；Windows 安装、启动、卸载、DPI/GPU 与跨系统对照尚未实机验证。
- 三维为平面投影，无逐像素几何相交深度缓冲；重新指定父级时 TRS 不能精确保留剪切。
- 多行文字内容可保存和渲染，但文字框尺寸仍显式设置，尚未完成内容自动测量与画布内浮层。靠近合成边界的外部手柄可能被画布裁切。
- Linked Asset 仍引用外部绝对路径，跨机器需要重新链接。PNG 序列最多 3000 帧或 512 MB，建议分段。
- CPU 基准不包含 Canvas、React、素材解码；大工程真实播放帧率仍待专门测量。
- 未实现 MP4/视频解码、完整 3D、粒子、生成式视频、实际 AI 服务和 AE 插件兼容；不宣称已经达到完整 AE 的功能性。

## Blockers

无阻止本轮功能开发、macOS 本机使用和导出的外部阻塞。签名凭据、正式 Logo、Windows 测试环境是发行资源与平台验收缺口，详见 DESKTOP_KNOWN_LIMITATIONS.md。

## Next 5 Highest-Value Tasks

1. 多行文字自动测量、文字框同步和画布内编辑浮层。
2. 大工程真实播放与拖动耗时，针对实际热点优化 React/Canvas。
3. Windows 实机完整创作、原生生命周期与文件关联验收。
4. 父级剪切、负缩放、多选变换和边界手柄交互回归。
5. Linked Asset 跨目录迁移、重新链接和恢复窗口的原生流程回归。
