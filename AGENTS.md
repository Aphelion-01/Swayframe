用简体中文回答，代码、命令、文件名和 API 名称保持原样。只读取当前任务必要文件，简洁报告真实验证结果。

Whenever modifying user-facing UI or adding a new user-facing feature:

1. Read DESIGN.md first.
2. Identify frequency, scope, context, and primary user task.
3. Consult FEATURE_LOCATION_MATRIX.md.
4. Reuse an existing entry point when possible.
5. Do not add a new permanent button unless DESIGN.md placement rules justify it.
6. Update FEATURE_LOCATION_MATRIX.md if a new capability is introduced.
7. Run a UX heuristic check after adding a new major workflow.

Project mutations must use the shared Command System / Transaction. Intelligence only outputs Proposal. Layout and entry state stay outside Scene.
