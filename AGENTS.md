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

## MANDATORY UX RULE

Before adding any user-facing feature:
1. Read DESIGN.md.
2. Define object, task, frequency and context.
3. Choose one of the nine fixed domains.
4. Assign one canonical home.
5. Register the command (reuse existing Command/Transaction).
6. Register the feature without business callbacks.
7. Use an existing typed contribution point.
8. Update FEATURE_INVENTORY.md and FEATURE_LOCATION_MATRIX.md.
9. Do NOT modify global toolbar / shell unless placement and budget justify it.
10. Run Feature Placement Review and registry validation tests.

局部参数表单与直接操控手势由注册 Section/Tool 管理；不得绕过 Command System 修改 Scene。禁止新建 Misc/Other 分类或远程插件框架。
