# Swayframe 1.0.6 — Draw Speed Curve

## 真实代码审计与最小实现决策

- 原生数据：`src/core/project-model.ts` 的 `Property<T>.keyframes`、`Keyframe.interpolation`；区间插值归属于左关键帧。`incoming/outgoing` 是时间 Bezier，`spatialIncoming/spatialOutgoing` 是路径几何，二者已分离。
- 真实求值：`evaluateProperty` → `interpolationProgress`（`src/core/animation-engine.ts`）→ 数值混合或 `spatialPoint/spatialPoint3`。`src/core/renderer-core.ts:createRenderSnapshot` 和 `src/renderers/output-frame.ts:OutputFrameRenderer.draw` 复用该入口；Graph 的 `sampleCurve/propertySpeed` 也复用同一数据。
- 持久化入口：`applySpeedCurveCommands` 解析目标相邻区间，构造既有 `keyframe.update`，由 `EditorStore.run` → `CommandSystem.executeTransaction` 提交。事务先验证完整候选与可保存性，再发布 Scene/Undo。连续绘制只在松手时提交一条历史。
- `src/core/editing-commands.ts:copyFrames/pasteFrames` 复制原生插值；移动时间、编辑属性值、删除帧继续使用原命令。曲线不被烘焙成额外关键帧。
- 保存：`project-schema.ts` 与 `command-schema.ts` 共同引用 `interpolationSchema`；`project-io.ts:saveProject/loadProject` 使用既有 `schemaVersion: 0.7.0`。新增联合分支不向未使用功能的工程添加字段；无第二套迁移机制。
- 最少必要修改包括：类型/共享 Schema 与求值、一个局部积分模块、现有 motion command builder、Graph 中的区间编辑组件、Timeline 标签/插值选项、读取诊断，以及既有注册/布局样式。没有更改 Renderer、Scene、Command/Undo 或动画时钟的架构；无新增依赖。
- 旧项目风险：新应用中的旧模式分支不变；使用新插值的工程需要 1.0.6 或之后的兼容版本，旧应用不认识该联合分支。空间路径使用已有 Bezier 参数进度，未引入弧长重参数化。
- 未发现必须重写动画系统的阻碍。

## 数据与算法

```ts
{ type: 'custom-speed', points: readonly { t: number; speed: number }[] }
```

数据存于起点关键帧 `interpolation`，时间为 `[0,1]`，相对权重非负、上限 16；2–128 点，严格递增，包含 0、1。总面积必须大于零。持久化校验拒绝非法数据，绝不静默排序/删除非法已保存数据。

相邻点 `(ta,va)`、`(tb,vb)` 的面积为 `(tb-ta)*(va+vb)/2`。预计算前缀面积；当前点 `u` 的局部积分是 `va*d + (vb-va)*d²/(2*(tb-ta))`，`d=u-ta`。累计面积除以总面积得到进度。二分定位区间；冻结数据按 interpolation 对象用局部 WeakMap 缓存。可变预览不缓存，原生 immutable Command 更新自然失效。

该分支替代旧时间缓动，不叠加旧 Easing；端点时间/值与空间手柄保持不变。所有绝对时间求值与 FPS 无关。零速平台保留，端点使用一致的累计面积避免平台边界出现微小浮点重组差异。非法直接调用的速度对象安全返回线性进度；正式 Command 仍严格拒绝。

## 实际入口与支持范围

1. 为位置、缩放、旋转或透明度设置至少两个关键帧。
2. 在原有“曲线编辑器 → 数值/速度”选择动画属性；多个区间时用右侧“区间”选择相邻帧。
3. 选择工具条“手绘速度”，从左向右按住左键/笔绘制，松手提交。底部表示零速，虚线为只读累计进度，红线是当前播放时间。
4. 可选择匀速、加速、减速、慢–快–慢、中途停顿。预设与笔迹使用同一数据与求值器，匀速同时是重置。
5. Esc、pointercancel、失焦、对象/工程变化取消草稿；失去捕获后由现有 `usePointerRelease` 继续接收窗口释放，校验 pointerId 和原始工程快照。

V0 编辑入口支持：2D Position/Scale/Rotation/Opacity，以及既有 3D position3D/rotation3D/scale3D、cameraPosition/cameraTarget。其他属性暂禁用该编辑入口，避免数值开关等特殊语义被强行插值。底层复用同一连续数值/向量/数组进度映射；保留原有 Hold、Spring、Linear、Bezier。

笔迹采样限制 4096，去除无效值、排序/去重并补端点，以确定性的误差优先简化限制 128 点。零速连续区间的两端为强制保留点；停顿过多超限会拒绝并提示，不悄悄抹掉停顿。笔压、高级平滑、全局 Time Warp、音频变速、反向/超调均未实现。

## 读取错误与保护

`loadProject` 新增可选诊断回调，损坏的 `custom-speed` 仅在读取流程降级为 Linear，保留路径和原始 interpolation 对象供诊断。`EditorStore.load` 显示数量与另存提示，并记录完整诊断。源文件不会被读取过程覆盖。`saveProject`、共享 Schema 和 Command 不做此降级，拒绝无效候选；不存在为了通过测试放宽校验。

## Feature Placement Review / UX 检查

对象 Keyframe；任务 Animate；频率 F3；上下文 PropertySelection；九域 MOTION；canonical `motion.toolbar`。`draw-speed` 注册为现有 `motion` scoped Command，Graph 使用现有 typed contribution point，不在 Feature 元数据保存业务回调。直接绘制/预设属于同一注册能力的局部参数工具。

应用 `DESIGN.md`：复用五区布局、现有 Graph/Timeline、共享预览时钟、语义颜色和紧凑控件；零新全局按钮。手绘时图区保留合理最小高度，仍处于原可调整停靠区。手绘 Inspector 解释权重/积分，隐藏不适用的 Bezier 参数；其它模式中明确提示将用 Linear/Bezier 替换自定义速度。更新了 `FEATURE_INVENTORY.md` 与 `FEATURE_LOCATION_MATRIX.md`。

UX heuristic：当前模式/错误/取消有文本反馈；Undo 一笔一次；非法全零不提交；项目/选择变化不误写；0%/100% 与零基线、五个预设增强发现性；不动画化直接操控；局部横向滚动保持窄窗口可用。四个桌面尺寸截图与注册校验结果见 QA 目录。

## 验证与边界

最终结果：**960/960 测试、6/6 真实 Electron 场景通过**；TypeScript、Lint、桌面构建和两端各 25 个载荷文件校验通过。

最终测量值以 `docs/qa/draw-speed/freeze.json`、`unit.json`、`electron/report.json` 为准，不将初始夹具失败当作 PASS。

- 数学/原生命令：A–K 的匀速、加速、减速、停顿、反向/负/相同值、Undo/Redo、保存重载、修改时间与值、24/30/60 FPS、非法数据、旧工程字节一致回归；空间几何、关键帧复制/粘贴、端点删除、四个基础属性。
- React + 真实 EditorStore/Command 的交互检查：草稿不改 Scene、一笔一条历史、Esc、pointercancel、全零拒绝、旧工程释放、错误 pointerId、同工程交错编辑及选择变化取消。该层不冒充真实 Renderer。
- 真实 Electron：原 App 中鼠标创建图层、属性栏开启动画及输入第二帧、原 Graph 中鼠标手绘加速、真实可见工具栏 Undo/Redo；共享时钟播放；项目实际写入文件后重开继续播放；真实 OutputFrameRenderer 输出 0/1/2 秒 PNG，检查蓝色图层在实际求值位置，帧内容不同；重载同一帧逐像素一致。
- Electron 输入来自 Chromium `Input.dispatchMouseEvent` 并检查 `isTrusted`。时间跳转/播放由真实 store 时钟入口驱动，文件重开由真实序列化/磁盘文件/EditorStore 执行；未自动操作系统保存对话框。
- 未实测物理数位笔、Windows GUI；Pointer Events 的笔指针不依赖专有设备 API，但不能将鼠标验证称为数位板硬件验证。
- 无 AI/Agent/付费 API；测试进程禁止 HTTP 及模型调用，使用独立 userData。
- Mac/Windows 安装包与测试构建逐文件核对；未签名/公证，Windows 未实机运行。未替换用户当前安装，也未修改用户正在编辑的工程。

## 实际命令

```sh
npm run typecheck
npm run lint
npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/draw-speed/unit.json
npm run desktop:build
node work/draw-speed-qa/build.mjs
SWAYFRAME_USER_DATA=/private/tmp/sf-draw-speed-qa-unique /path/to/Electron work/draw-speed-qa/.compiled/desktop-dist/main.cjs
node work/draw-speed-qa/package-integrity.cjs
```

实际源码清单与 Commit 在 `freeze.json`；PNG、截图、早期夹具失败与日志均保留在同一 QA 目录。历史 V2-7 报告未覆盖；测试自动生成的旧输出另存后还原原字节。
