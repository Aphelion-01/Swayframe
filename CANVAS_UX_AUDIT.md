# Canvas Interaction 审计

基线：0.9.7。仅改 Canvas 及其共享坐标/命中/历史入口，要求见 docs/baseline/V02_CANVAS_INTERACTION.txt。

## Working

统一 ToolProvider 提供 Selection/Hand/Rectangle/Ellipse/Pen/Text。Canvas、Toolbar 共用 Tool。Selection 使用 EditorStore；临时 Move 预览与正式 Command 分离。已有多选共同支点、八向缩放、旋转、锚点补偿、屏幕像素吸附、Space/中键平移、光标缩放、文字和路径入口；已有数学与交互回归。

## Partial

旋转只返回起点到当前点的最短角，无法连续跨过180°。边缩放受 Inspector XY 链接影响会错误缩放两轴。缩放百分比混用了 Fit 倍率与真实像素倍率。手柄预览未同步 Inspector；多选仍显示首层属性。预合成可进入，缺少返回路径。

## Broken

隐藏/非活动层会被框选；锁定顶层阻挡后面的可编辑层。Shift 锁定轴每次移动重算，抖动会切换方向。Space释放之前的抓取光标可能遗留。Canvas仅在合成矩形内响应空白框选，外围留白没有入口。

## Missing

Alt起始复制拖动的一次Transaction；合成统一坐标函数；对象hover轮廓；角外旋转命中区；按键重复微调合并；手动缩放时resize保持真实倍率。

## Interaction conflicts

Alt目前用来临时关闭吸附，与复制拖动冲突；本轮改Ctrl/Cmd临时关闭吸附，Alt仅起始复制。Inspector轴链接属于数值属性操作，不应改变边手柄单轴语义。Shift角缩放解除默认等比例，边缩放按Shift临时等比。

## Performance problems

Canvas订阅整个EditorStore；已有同视觉工程缓存避免节点选区等无关绘制，但仍存在Canvas函数重算。手柄预览将重求值合成，需保留未变图层引用和既有求值缓存，不重写框架。暂未测量真实FPS，不把单元测试耗时当FPS。

## 0.9.8 复核

以上保留为修改前审计。Partial/Broken/Missing 的二维核心交互项已修复：连续旋转、单轴缩放、真实倍率、属性预览、Mixed、多选、复制拖动、边界外框选、稳定锁轴、hover、返回路径、resize、微调合并。增加基础等间距引导。Canvas 采用字段订阅，保留既有缓存。蒙版精确命中、复杂 spacing、真机 DPI/FPS 的剩余边界见 CANVAS_UX_RESULT.md，不标记为已验证。
