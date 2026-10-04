# 实时数值编辑验收 — Swayframe 0.6.2

按用户要求完成：只有实际包含 XY 的二维/三维向量保留链接按钮；标量、颜色、区域四分量、路径不显示或应用 XY 链接。属性数值向上拖增大、向下拖减小，Shift×10、Alt×0.1；点击输入。名称原横向 scrub 保留。

输入及方向键立即预览，链接另一轴同步显示；输入 Enter/离开字段提交，拖动松手提交，每次只一条共享 Command/Transaction。Esc/窗口失焦/捕获丢失/工程或时刻变更取消，无效中间输入清预览，Preview 不进入正式文件或 autosave。字号、尺寸、时间范围、摄像机、Motion Curve、速度/空间路径数值都接入预览。

自动验收：72 文件 / 192 tests，typecheck、lint、tests、Web build、desktop build 全 PASS，原始日志 quality/V2-11.log。新增测试覆盖输入即时预览、同步两轴、Enter无重复、100次纵向移动一次历史/当前时刻一帧、解链/向下拖/取消、无效输入/过期、几何/字号和图标资格。既有曲线速度和遮罩羽化的共享历史测试通过。

网页实测：矩形原旋转0°，输入25°后仍聚焦输入、画布实时旋转，历史保持0；Esc恢复0°。数值向上拖30px后30°且历史1，一次Undo恢复0°/历史0。原工程经取消/Undo还原。截图 numeric-edit/typing-preview.png、vertical-drag.png。

桌面安装包更新0.6.2，仍未签名/公证，Windows仅交叉打包。安装包构建日志 quality/numeric-edit-package-mac.log、numeric-edit-package-win.log。最终包哈希 numeric-edit/release-evidence.json。所有修改继续通过原 Command System 提交，无第二套关键帧或效果状态。
