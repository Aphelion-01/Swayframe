# Image-to-Layers V0.1 真实证据

本目录保留输入、原始蒙版、成功/失败结果、原生 Renderer PNG 和运行报告。生成结果仅用于本项目功能验收及编辑检查，不用于训练其他 AI 模型。

- `generated/`：三照片的初始真实输出，每个根含 `composition/` 标准 P3 包与同级 `analysis/` 原始蒙版/来源/缺口。
- `alpha/`、`alpha-metrics.json`：白/黑/品红/棋盘底、局部边缘放大；Python仅诊断，不替代 SF Renderer。
- `final-repeat/`：真实 Electron + App/Store/ProjectService + NativeServices + Vision + P3 Importer，17项完整复验。
- `production/`：正式 `dist/index.html`、未追加 QA 的 production preload、打包 helper，4项验证。不是 Windows 实机验收，也不是对整个已安装 App 的人工测试。
- `real/`：首次17项及1280/1440/1920/2560视口截图；`final/`：一次16项后收尾未完成的失败试跑，不算 PASS。
- `corrupt-only/`：损坏输入单独验证。
- `all-tests.json`：首次908全通过；`all-tests-final.json`：907通过+1项旧 Agent 5秒超时；`boundary-repeat.json`：该文件9项单独通过。保留所有结果，不覆盖失败证据。
- `mcp-exit-regression/window-close/`：独立 MCP 客户端持有真实导入时关闭 Electron，5项退出回归。

文件选择器在自动验收中程序化选取受控照片/目录；实际主进程授权、生成、导入、渲染和保存均执行产品代码。没有使用模型 Mock 结果。异常注入只针对 staging 写失败和真实生成响应的返回时机。

最终受控并发 `all-tests-confirmed.json`：908/908 PASS；未改测试时限或语义。`probe/`保留受限沙箱失败与本机探测日志，探测mask经CoreImage转换不作为正式Alpha证据。

`production-final/`：最终打包完成后再次使用包内helper和正式dist/preload验证，4/4通过。
