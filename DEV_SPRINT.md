# Current Goal

按 `docs/baseline/DEV_SPRINT_V2.txt` 自主推进完整创作流程。先完成 CG 桌面收尾，再优先修复连续交互与 Canvas/Timeline 操作问题，复用既有 Command/Property/Graph。

# In Progress

Timeline 批量关键帧/图层时间条边界与吸附；播放头取消行为。

# Completed

CG-0～CG-12 全部实现与桌面验收，0.6.0 两平台安装包构建成功；图片/曝光/Merge/动画保存重开/旧效果迁移实测通过。

V2-1：拖动捕获播放头时间并拒绝过期提交；窗口失焦取消连续预览。

V2-2：Canvas 边缘/中心吸附、临时参考线、Shift 锁方向与 Alt 关闭；100次移动一条历史，取消不修改工程。

# Next High-Value Tasks

1. 连续拖动过期/取消保护，保证一次 Undo。
2. Canvas 构图吸附与临时参考线。
3. Timeline 关键帧吸附、时间边界与快捷操作。
4. 文字直接编辑与输入焦点回归。
5. 完整保存/导出和桌面包更新。

# Known Regressions

未发现门禁回归；Canvas 过期手势已修复。Timeline 拖动超出时长时原来先显示越界预览再拒绝提交，正在改为受限预览。

# Blockers

无开发阻塞。Windows 实机、发行签名和正式 Logo 资源缺少；不阻止本机开发。

# Test Status

Baseline：62 文件 / 165 tests。V2-1：166 tests；V2-2：64 文件 / 170 tests。typecheck、lint、tests、Web build、desktop build PASS，见 `outputs/quality/sprint-v2-interactions.log` 与 `V2-2.log`。
