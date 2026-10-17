# Computer Use 恢复检查（2026-10-10）

范围：Codex 原生桌面自动操作接口；未修改 Swayframe 源码或工程内容。

## 操作与结果

- 重置 CUA JavaScript 会话后，应用清单读取成功，但首次 Finder 绑定仍异常耗时；15 秒调用超时未有效限制等待。
- 确认独立服务 `SkyComputerUseService`，仅对该服务发送 TERM，并通过 macOS `open` 重新启动。未退出 Codex 或 Swayframe。
- 重启后 Finder 绑定 0.4554 秒，帮助菜单打开与状态读取 0.5008 秒，菜单取消与状态读取 0.4700 秒。
- Swayframe 首次绑定仍耗时 902.8233 秒，最终返回 `live-final — Swayframe` 窗口。不能将首次绑定问题记为修复。
- 已绑定的 Swayframe 帮助菜单打开与状态读取 0.9736 秒，菜单取消与状态读取 0.4315 秒。菜单已关闭，未修改 Scene。

## 结论

当前已绑定窗口的自动操作已恢复，可继续复用现有绑定。首次应用绑定的异常等待与超时失效仍未解决；根因尚未确认，不能宣称永久修复。该接口由 Codex 的外部 Computer Use 服务提供，不属于 Swayframe 仓库源码。后续不得以重复首次绑定作为无界重试，也不得将此恢复检查当作 Swayframe V0.4 全部原生界面验收通过。
