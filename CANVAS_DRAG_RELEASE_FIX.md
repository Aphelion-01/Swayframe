# Swayframe 1.0.5 — 预览画布拖动回弹修复

## 可复现原因

1. `Canvas.tsx` 的 `onLostPointerCapture` 原先立即清除手势和拖动预览、调用 `store.cancelDrag()`。捕获中途丢失后，正式 Scene 仍为原位置，出现回弹。
2. `onPointerUp` 原先直接提交上一次 move 预览，没有采样松手位置。最终释放坐标比最后一次 move 更新时，物体不能到达目标。

已在修复前复现同类症状；这不等同于获取了用户此次故障的设备事件日志。原始失败见 `docs/qa/canvas-release/before.log`。

## 修复边界

- 复用 `usePointerRelease` 的 window 兜底；仅处理拥有手势的 pointerId。
- 捕获丢失不是取消，保留手势；窗口内继续移动和松手仍可提交。
- 松手先计算最终位置，再经原 `EditorStore.endDrag` / `CommandSystem` / Transaction 一次提交。缩放与旋转也沿用各自原数学与命令。
- 原窗口捕获事件由 React 处理；仅失去捕获后的窗口事件兜底，避免重复采样 / 提交。
- Esc、真实 pointercancel、窗口失焦、工程与时间变化仍取消，不能把过期拖动写入新工程。
- 既有鼠标事件兼容派发器缺少 pointerId 时沿用最后预览；原生 PointerEvent 具有有效 pointerId 时采用最终释放坐标。
- 只修复已有 Canvas 图层操控，未增加入口、按钮、模型、Registry 或新编辑内核；正式修改仍走共享命令与事务。

## 验证

- 944/944 全套测试通过，保留原断言与超时；`unit.json`。
- 三项新增回归：中途丢失捕获后窗口继续拖动、释放坐标更新、非所属指针不能结束拖动且明确取消无写入。
- 45 项画布 / 变换定向检查通过；其中新增三项修复前失败，修复后通过。
- 真实 Electron 的四组验证通过：捕获丢失路径、最终释放坐标、Esc 取消、连续八次拖动；检查 Undo、Redo、保存重载与真实 Renderer PNG。
- 鼠标输入使用 Chromium `Input.dispatchMouseEvent`，验证 `isTrusted`。捕获丢失在可用时通过原生 release，否则显式 DOM 故障注入，**不冒充物理设备捕获丢失的实测**。早期夹具要求 CDP 必须稳定建立 native capture，未通过的记录保留；最终验收不再混淆该能力与产品故障处理。
- CDP / CSS 坐标存在小数像素量化，实际释放位置容差 0.05 合成像素；单元坐标断言保持精确。
- 未调用模型 API，未修改用户正在运行的工程。安装包未签名 / 公证；Windows 未实机运行。

## 复现命令

```sh
npm run typecheck
npm run lint
npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/canvas-release/unit.json
npm run desktop:build
node work/canvas-release-qa/build.mjs
SWAYFRAME_USER_DATA=/private/tmp/sf-canvas-release-qa-unique /path/to/Electron work/canvas-release-qa/.compiled/desktop-dist/main.cjs
node work/canvas-release-qa/package-integrity.cjs
```

报告与截图：`docs/qa/canvas-release/`；完整产品源码 Commit、安装包 SHA 与载荷验证见该目录的 `freeze.json`、`installers.json` 和 `package-integrity.json`。
