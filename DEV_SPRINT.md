# Current Goal

按 `docs/baseline/DEV_SPRINT_V2.txt` 自主推进完整创作流程。先完成 CG 桌面收尾，再优先修复连续交互与 Canvas/Timeline 操作问题，复用既有 Command/Property/Graph。

# In Progress

八方向画布缩放手柄，保留 X/Y 链接偏好和一次 Undo。

# Completed

CG-0～CG-12 全部实现与桌面验收，0.6.0 两平台安装包构建成功；图片/曝光/Merge/动画保存重开/旧效果迁移实测通过。

V2-1：拖动捕获播放头时间并拒绝过期提交；窗口失焦取消连续预览。

V2-2：Canvas 边缘/中心吸附、临时参考线、Shift 锁方向与 Alt 关闭；100次移动一条历史，取消不修改工程。

V2-3：关键帧整体边界限制、播放头/关键帧/边界吸附、参考线和捕获取消；图层入出点至少一帧，播放头取消恢复起点。

# Next High-Value Tasks

1. 连续拖动过期/取消保护，保证一次 Undo。
2. Canvas 构图吸附与临时参考线。
3. Timeline 关键帧吸附、时间边界与快捷操作。
4. 文字直接编辑与输入焦点回归。
5. 完整保存/导出和桌面包更新。

# Known Regressions

未发现门禁回归；Canvas 过期手势、Timeline 越界预览与捕获取消已修复。

# Blockers

无开发阻塞。Windows 实机、发行签名和正式 Logo 资源缺少；不阻止本机开发。

# Test Status

Baseline：62 文件 / 165 tests。V2-1：166 tests；V2-2：64 文件 / 170 tests。typecheck、lint、tests、Web build、desktop build PASS，见 `outputs/quality/sprint-v2-interactions.log` 与 `V2-2.log`。

V2-3：66 文件 / 175 tests，全门禁 PASS，见 `outputs/quality/V2-3.log`。Git checkpoint：f90e1e4。
