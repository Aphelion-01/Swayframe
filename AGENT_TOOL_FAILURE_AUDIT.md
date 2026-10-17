# Agent Tool Failure Audit — 0.9.23

用户报告 createText 参数无效，但提供的附件没有原始 Tool Arguments/Execution Context；现有 outputs/agent-creation 的留存日志未找到本次失败调用。因此不能断言用户那次调用究竟传了哪个字段。

可证实的契约缺口：旧 createText 只有 content/name/position/width/height/layerId，严格模式拒绝 fontSize/fontFamily/color/alignment；parsed() 丢弃了 Zod issues，只返回“参数无效”。本轮真实 Adapter 测试故意传 content=22、position=[1,2]、fontSize=-5，捕获具体字段和原参数；有界规划测试传 fontSize="large" 后修正为36并成功执行。此为本地回归调用，不冒充用户原始失败日志。

新错误记录包含 Tool Name、Arguments、Expected Schema、字段 expected/received/reason/recoverable；计划预检活动记录另带 projectId/compositionId。错误工具状态为 failed，不记为 completed。AgentTransaction 执行在隔离工程，结果验证后才允许一次提交。

FLAC 的边界：旧导入把 AudioTrack.canDecode() 当成唯一能力门禁，与 Web Audio 的实际解码覆盖不一致。新路径补足回退；实际 FLAC 样本在 Electron 成功导入/解码/混音/保存/撤销。未获得用户失败的原始 FLAC 文件，仍不能断言任意损坏/特殊编码文件均可导入。

## 0.9.24 真实 Provider 审计

用户已明确授权参考图、测试渲染图和测试工程工具上下文外发。实际 DeepSeek/deepseek-flash 调用取得 submitProposal、submitPlan 与 submitVisualAssessment，首次网络验收没有提交用户工程。真实失败记录保留于 outputs/agent-reliability-023/first-real-calls.json / first-live-report.json：缺失 steps、参考元素依赖无效、专业分析返回不完整 JSON、视觉修正 creation.tasks 引用不存在的 layer.fill。第一轮实际图像 failed-render-1.png 存在透视面不足、比例与排版偏差，不能计为参考重建成功。

修复：专业分析校验反馈具体字段路径与原因；无效 Provider JSON 最多恢复一次（认证/网络错误不自动循环）；视觉修正先按当前沙箱工程预检，失败后反馈实际错误并最多纠正一次，合法修正仍由原 Transaction 执行。独立验收 IPC 使用明确错误信封还原 AIError，避免 Electron 异常字符串丢失错误类型影响测试真实性。

## 0.9.26 追加审计
真实 0.9.24 调用里的路径顶点采用 `[x,y,0,0,0,0]`，但 `pathSvg` 读取的手柄是层内绝对坐标，因此非原点顶点被曲线拉向原点；这不是 renderer 随机误差。另一个真实计划创建并设置了径向渐变节点但未连接 Output，所以参数持久化成功不代表渐变可见。原始用户 createText 失败的完整实参仍未获得，不能将上述新发现倒推为原始文字错误原因。
