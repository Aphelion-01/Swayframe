# External AI-to-Composition 实测证据

本轮为通用外部 Agent 工作流，GPT Work 未验证。不存在付费生图或额外模型 API。

- source.png：NASA astronaut真实照片，P7来源归属见 ../segmentation/inputs/ATTRIBUTION.md。
- p7-output/：本轮真实本机Vision输出；保留原始mask、未补全背景洞和provenance，不用于训练其他AI模型。
- composition/：标准P3包，四个真实RGBA8 PNG，reference只参考。
- reference.png：外部Codex脚本设计的标题参考，不冒充原照片的隐藏分层恢复。
- workflow.swayframe：经真实MCP导入、GUI/MCP编辑、保存重开后的原生工程，四个内嵌资产及主体两关键帧。
- run/：首次25项PASS；final-run/：补充协议/GUI属性观察后的25项PASS。
- final-run/tool-calls.json：57次真实调用及返回，images只保留hash/大小，实际PNG单独归档。无临时连接令牌。
- final-run/visual-report.json：4组图像对比+动画变化范围5项PASS，图像单通道最大差1，容差2。
- regression.json：本轮定向65/65；build.log含typecheck。没有冒充重跑全量908项。
- source-protection.json：产品、依赖、注册表和历史冻结报告与23efd55无差异。

本轮字幕和装饰是Raster，不能逐字修改或调整矢量节点。人物底部保留原摄影裁切边，发丝可能有原背景混色。PNG/参考仅用于功能验收，不作为人物商业背书或训练许可。

真实GUI选择器返回固定受控fixture，不等于人工点选测试；正式dist/preload/原生Importer/Transaction/Renderer/保存均实际运行。MCP默认关闭，测试完成撤销授权；本机协议TCP不同于HTTP网络计数。
