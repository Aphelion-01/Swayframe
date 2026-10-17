# AI2Comp V0.1 — 结果与使用说明

**限定Mac真实图片→双层PNG→P3/P4→原生编辑路径 E2E PASS。精细分割、隐藏背景补全、Windows自动分层 NO-GO。**

## 用户路径

文件 → **图片转分层（Mac 本地）…** → 选择不透明PNG/JPEG → 选择输出文件夹 → 查看画布/层数/顺序/缩略图/限制 → 确认导入。之后在原生图层、属性、时间轴中移动、改透明度、添加关键帧、Undo/Redo和保存。

最长边超过1024会缩小。输出默认Background（遮挡区域未补全）和Main Subject；不生成可选第三层、不推断深度。移开主体后背景露透明洞，软边可能残色，复杂发丝需外部修正。预览可取消或改选；完成导出的包不会随取消/Undo被删除。外修PNG后复用“导入分层合成…”；用户无需编辑manifest。

## 实现范围与设计审查

独立分支`codex/ai2comp-image-layers-v01`，起点`c814c1e`，版本仍1.0.3的V0.1候选，不冒称正式新版本。原dirty工作区不覆盖；历史P3/P4/V2-7报告不重写。没有云模型、MCP新功能、Agent重构、第二编辑器/Scene/Command/Renderer。

对象Asset/Composition，任务生成并导入，频率F4，上下文合成，九域PROJECT，canonical home `menu.file`，复用原typed command contribution和P4弹窗。更新FEATURE_INVENTORY.md及FEATURE_LOCATION_MATRIX.md，无新常驻toolbar。

按professional-creative-editor-ui和ux-heuristics复核：本地流程9/10，最高S1为导出目录信息折叠且缺少直接在文件管理器定位/重导入的一步入口；现有可复制完整路径并重选文件夹，不阻塞核心流程。若要10/10，后续可在现有弹窗动作区补受控“显示输出文件夹”，不应新增常驻按钮。本轮未扩展此范围。1280/1440/1920/2560实际视口检查无边界溢出；正式1440截图复核通过。此评分是启发式检查，不是用户研究或图像质量评分。

## 证据与验收边界

- `docs/qa/segmentation/final-repeat/report.json` 17/17真实Electron路径；`production-final/report.json` 4/4正式dist页面。
- `alpha-metrics.json`及`alpha/`保留不理想边缘和原始蒙版；原生Renderer逐像素检查及两层编辑动画PNG在final-repeat。
- staging写失败、损坏图、取消/切工程晚到保持Scene隔离；关闭回归5项、进程正常退出。
- 首轮908/908；一次全量907/908（旧Agent测试5秒超时）和单独9/9均保留，最终并发复验all-tests-confirmed.json：908/908通过。不降低原语义/超时，不调用模型重测。
- Windows安装包仅静态完整性验证；本地分割入口禁用，原P3分层包导入继续可用。未进行Windows实机测试。
- 包为未签名候选，Mac未公证。安装包及SHA见`docs/qa/segmentation/installers.json`，载荷对照见package-integrity.json。

源码路径、资源限制、事务和许可详见其余四份报告。允许继续收集有边界的Mac使用反馈，不允许将本结果升级为任意图片自动还原能力。
