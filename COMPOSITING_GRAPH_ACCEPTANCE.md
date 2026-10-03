# Compositing Graph V0.1 验收记录

2026-10-04；Swayframe 0.6.0，Project schema 0.5.0，graph.version 1。CG-0～CG-12 已实现并通过阶段质量门禁，详见 `outputs/COMPOSITING_GRAPH_STATUS.md`。本轮最后门禁最初为 62 文件/165 tests，后续 V2 连续交互回归增加测试，以各门禁原始日志为准。

| 场景 | 结果与证据 |
| --- | --- |
| CASE01 图片→Exposure→Output | macOS 安装包打开内嵌 PNG，默认 Source→Output；GUI 添加 Exposure=1，实际画面改变并保存。`native-source.jpg` / `native-exposure.jpg`；保存值独立检查见 native-roundtrip-evidence.json。 |
| CASE02 Exposure→Gaussian Blur | Web 实际调整 radius=30，边缘扩散，截图取样变化见 web-pixel-evidence.json 和 blur.png。Canvas evaluator 回归测试确认 blur(30px)，非 CSS 效果。 |
| CASE03 半径参数动画 | Web GUI 创建 0s=0/1s=30，两帧出现在同一 Timeline；macOS 重开动画工程，1s 节点摘要求值为30且画面模糊，见 native-animation-reopened.jpg。自动测试检查 Property(t)、Timeline、Undo 和 IO。 |
| CASE04 Effects↔Graph | compositing-stack/ui 测试通过效果面板添加、图中删除与单一数据源同步；线性视图派生，分支提示转到图编辑。 |
| CASE05 Source+Solid→Merge | 真实 macOS merge 工程显示图像前景与 Solid 背景，native-merge.jpg；RGBA 独立测试覆盖透明度、Mask 及四种混合模式。 |
| CASE06 禁止循环 | compositing-graph/commands/ui 测试验证环、自连、类型和容量冲突，拒绝且不产生部分工程/历史；GUI 自连错误提示覆盖。三节点循环由核心测试覆盖，未声称手工拖三条线验收。 |
| CASE07 连续移动一次 Undo | jsdom 交互发送50次 pointermove，松手仅一条历史，一次Undo恢复，Escape取消；core测试另覆盖多次坐标预览，UI平移/缩放不改工程。 |
| CASE08 插入自动断线重连 | 共享 Transaction 生成节点、断线、两条新线；一次Undo完整恢复 Source→Output；真实 GUI 搜索插入已操作。 |
| CASE09 保存关闭重开 | macOS GUI 修改动画节点名称、保存、退出并重启；名称恢复，1s求值30。磁盘文件独立检查 positions/params/edges/keyframes 与原文件一致，schema0.5.0，见 native-roundtrip-evidence.json。 |
| CASE10 旧效果栈迁移 | 0.4 Effect Stack→Graph 迁移单测保留顺序、enabled、Property/Keyframe ID，去掉effects，保存加载相等；macOS 打开 legacy-effects 工程可视核验。旧色相参数补 lightness=0。 |

图片和证据均在 `outputs/compositing/`。自动测试包括拓扑/端口、删除/复制、固定节点保护、编译、安全旁路、缓存、Source签名、故障恢复与 Agent 原子 batch；真实 GUI 证据补充浏览器/Canvas 原生能力，二者分开记录。

预览与 PNG/序列共享 Canvas2DRenderer，不另建导出效果管线。Web 截图取样验证 Exposure/Blur 像素确实变化；RGBA 单测覆盖 Merge 实际数值。没有在本轮专门实测全部节点组合的逐帧序列，原序列导出回归测试仍通过。

## 性能与边界

节点改名/移动、图视口 pan/zoom 不触发节点像素重算；测试以 evaluator 调用次数确认。参数只失效自身及下游，Source变化传播；缓存限64项/32 MB/图层，源表面最多4层/总32 MB，不包含活动临时表面。常用radius0～30保持padding128不重绘Source，更大空间边界会重建Source。尚未进行大工程持续播放的基准测试，不承诺固定帧率。

当前为每图层局部合成，不支持 Composition Graph、跨图层取源、多 Viewer、用户脚本、Shader、完整3D节点或生成式AI。Mask节点支持局部矩形/椭圆；旧图层Bezier遮罩保持原管线。Source/Output不可删除或禁用。未连接节点不参与Output计算，错误节点显示诊断并旁路。

macOS arm64 安装包在独立测试 profile 实测，避免覆盖用户旧版本窗口；Windows x64 NSIS仅构建成功，尚无Windows实机。安装包未签名，正式Logo未提供，详见 DESKTOP_KNOWN_LIMITATIONS.md。
