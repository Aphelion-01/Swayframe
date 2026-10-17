# 连续会话验收

离线实际 Electron App 的 S1～S8：8/8 通过；共22次 Fixture Provider 请求，22轮接受（其中1轮确定性撤回动画不调用Provider），另1轮拒绝草稿。S4/S7/S8失效引用在请求前停止。此完成率仅指脚本给定正确模型返回后的执行工作流，不是 LLM成功率。

| 场景 | 实际验收 | 结果 |
|---|---|---|
| S1 | RGB三个矩形→第二个改紫→第二个位置动画→第三个移中心→第一个宽高；五笔事务、Undo/Redo | PASS |
| S2 | Cubic标题→字体/字号→中文副标题→标题移动→透明度；真实标题ID不变 | PASS |
| S3 | 属性栏真实位置输入→Agent继续移动→当前选择透明度修改 | PASS |
| S4 | 删除对象后“刚才的矩形”失效，未重建 | PASS |
| S5 | 渐变背景→标题→动画→仅删除上一轮动画；渐变和文字保留，逆操作可撤销 | PASS |
| S6 | 真实磁盘保存/重载、新Session、原ID继续编辑 | PASS |
| S7 | 拒绝标题草稿→后续引用停止，Scene与Session不被污染 | PASS |
| S8 | Undo后第二对象引用失效→Redo原ID恢复→继续编辑 | PASS |

第二进程新配置目录、重启后文件加载和标题透明度修改：1/1 PASS，1次Fixture请求。每轮真实 PNG Renderer 非空像素验证；S1动画1秒帧测得16341个前景像素，不把此统计称为视觉审美验收。

对应记录：outputs/agent-v2-7/editor/report.json、restart-report.json、session-unit.json；完整源脚本 work/agent-v2-7/editor-main.ts / editor-renderer.tsx。单元/集成中的 jsdom Renderer mock 单列，不能替代Electron像素测试。学校服务已发送三场首轮及部分对照请求，但均被模型配置拒绝，尚无成功连续会话证据：LIVE VALIDATION PENDING。完整记录见 AGENT_V2_7_LIVE_PROVIDER_REPORT.md。

开发失败保留：initial-report（测试等待新App挂载时机错误）、font-check-report（错误检查静态字体字段，同时发现上下文读取静态字号问题并修复）、gui-check-report（测试脚本调用不存在的deleteSelection，已改真实layer.delete）。这些不是最终成功率分母；修复后完整8场重新运行。模型/执行错误不被隐藏或改写为成功。

最终付费复测只达到部分验收：三矩形新鲜创建、加载同一Scene后选择原第二UUID改紫、Cubic标题及重载后复合属性通过；C1原返回重放后与GUI/C2新请求链通过。A3/A4与B3/B4未完成，不将重载/选择的隔离复核冒充完整同会话序号连续测试。原8+追加20共28API，未超限，详见AGENT_V2_7_LIVE_PROVIDER_REPORT.md。
