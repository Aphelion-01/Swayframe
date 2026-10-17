# 0.10 test report

阶段门禁均执行 typecheck、lint、test、desktop:build，完整日志在 outputs/agent-010/<phase>/。PHASE0 为 640 项；PHASE1 643；PHASE2 645；PHASE3 648；PHASE4 650；PHASE5 656；PHASE6 659。后续最终计数以 final/quality.json 和 test.log 为准。

初次失败保留在 phase4-initial、phase5-initial、phase6-initial；均修复后重跑。PHASE7 实测发现上下文与实验脚本问题，保留首轮 live，修复后 live-fixed。测试 Fixture、真实模型与视觉评估必须分别统计。

| 要求 | 实际回归文件/场景 |
|---|---|
|01 错误 createText 修复|agent-execution-recovery / TEST-A|
|02 非法动态 Fill|agent-execution-recovery R1；agent-semantic-actions|
|03 形状→Fill 真实绑定|agent-object-reference 01；agent-semantic-actions|
|04 Text→Font→Position|native-creative-skill-flow；agent-object-reference 02|
|05 READ 后 WRITE|agent-execution-recovery R3/TEST-E；agent-object-reference 04|
|06 合法拓扑修复|agent-autonomous-recovery B1 native Cubic|
|07 循环安全拒绝|agent-autonomous-recovery B4|
|08 执行局部恢复|agent-execution-recovery TEST-C；agent-autonomous-recovery B2/B6|
|09 重复错误停止|agent-autonomous-recovery B5；agent-execution-recovery repeated replacement|
|10 不完整 JSON|agent-plan-recovery；agent-provider-protocol-010|
|11 HTTP401|agent-provider-protocol-010 401/no retry|
|12 不重复创建|agent-object-reference execution recovery；agent-autonomous-recovery B2/B6|
|13 人工修改保护|agent-object-reference 12；agent-execution-recovery TEST-D|
|14 多次 Keyframe Update|agent-execution-recovery R5/TEST-F/G|
|15 Skill 缺能力|native-skill-runtime requiredCapabilities|
|16 Skill Router|native-skill-runtime creative routes|
|17 等价 Provider 语义|agent-provider-protocol-010 严格文本/工具规范化；不同 endpoint 同共享编译器用例|
|18 Scene 未正确修改|agent-execution-evidence-010 aggregate verification|
|19 Renderer 空白|agent-execution-evidence-010 pixel rejection；真实命令事务不提交用例|
|20 Cancel/Timeout/Budget|agent-transaction；agent-execution-recovery TEST-H/I；agent-provider-protocol-010|

渲染空白检查保守判定：唯一明确可见、对比背景有颜色、完整在画面内且无复杂效果/遮罩的对象应有前景。淡入起点、零缩放、离屏或复杂图不强行以空白判失败；实际本地渲染仍执行。此检查不能替代复杂视觉目标评分。

最终门禁：157个测试文件 / 663项通过，outputs/agent-010/final/quality.json记录四项退出0。新增 Provider等价测试实际走两种endpoint fixture→共享编译器→正式Command；Renderer空白 fixture 实際 draft不提交且保留对象诊断。以上为离线受控测试，不是第二供应商或真实模型视觉验收。
