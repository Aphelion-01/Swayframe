# ADR 0001：本地 Web 与核心模块目录

日期：2026-10-03。状态：采纳。

任务书允许先以本地 Web 应用完成，并以模块目录代替完整 Workspace。采用 React/Vite/TypeScript strict；核心模块位于 `src/core/`，Canvas 实现在 `src/renderers/`，UI 位于 `src/ui/`。模块依赖与任务书中的 packages 对应。

这样可减少跨 package 配置，同时保持模型不依赖 React、DOM 或 Canvas。未来如需独立发布核心模块，可移动目录；当前不引入桌面壳或原生渲染链。
