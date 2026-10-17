# Motion System V0.1

Human-first、AI-native 的本地二维动画编辑器。唯一执行基线是 `docs/baseline/` 中的原始任务书；实施顺序为 T0 → T10。

## 启动

需要 Node.js 22.12+，推荐 Node.js 24。解压源码包，在工程目录执行：

```sh
npm ci
npm run dev
```

在浏览器打开终端给出的本地地址。生产构建与预览：

```sh
npm run build
npm run preview
```

## 使用

新建默认合成为 1920 × 1080、30 fps、5 秒。左侧创建 矩形、椭圆、文字 或导入图片；选择图层后在画布拖动，或在 属性面板 编辑位置、缩放、旋转、透明度。名称、显隐、顺序、语义元数据均可编辑。

时间轴 使用秒。在需要的时间为 位置、缩放、旋转、透明度 添加关键帧，编辑该时间的 属性面板 数值，并选择 线性、贝塞尔曲线或弹簧。每段使用左关键帧的插值；点击播放预览动画。拖动结束仅提交一次修改；Undo/Redo 支持按钮和 Cmd/Ctrl+Z、Shift+Cmd/Ctrl+Z。

保存下载 `.motion.json`，打开时先校验完整文件。工程会在当前浏览器自动保存；新建或打开工程清空历史。自动保存受浏览器存储容量限制，大图工程应使用显式保存。`outputs/examples/manual-four-layers.motion.json` 是实际浏览器保存并重开核验的示例。

左侧 Agent 使用固定 Mock 提示：“创建蓝色方块，从左侧进入，1 秒到中心，轻微过冲并淡入”。整个演示是一笔可撤销 Transaction。Layout/Color/Motion Advisor 先展示候选 Proposal，点击应用后才通过共享命令修改工程。

## 验证与架构

```sh
npm run typecheck
npm run lint
npm test
npm run build
node scripts/gate.mjs T10
```

架构见 `docs/ARCHITECTURE.md`，工程格式见 `docs/PROJECT_FORMAT.md`，阶段与验收证据见 `outputs/EXECUTION_STATUS.md`、`outputs/browser-acceptance.json` 和 `outputs/quality/`。`scripts/browser-acceptance.mjs` 导出 Browser Plugin Tab API 的验收函数；浏览器实测覆盖拖拽、播放、原生图片上传和文件下载、完全关闭重开、Agent、Proposal 与错误导入。架构测试通过 TypeScript AST 与类型检查约束核心依赖和模型写入路径。

V0.1 的 AI 是确定性 Mock；图片静态显示，不含视频导出、3D、复杂特效、真实模型服务或其他任务书禁止功能。字体使用浏览器系统字体。工程 JSON 可迁移版本入口已预留，未知版本明确拒绝。

## 基础编辑更新

默认拖动图层会自动记录位置关键帧；各属性秒表开启后，数值修改自动记录当前帧。菱形可拖动，Shift 多选后支持复制、粘贴和删除；图层也支持多选、复制、对齐分布。画布中键/Alt 拖动平移，Ctrl/Cmd 滚轮缩放；时间轴支持缩放和属性筛选。完整操作与快捷键见 `outputs/BASIC_EDITOR_UPDATE.md`。
