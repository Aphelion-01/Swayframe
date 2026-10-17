# Real DeepSeek reliability benchmark 0.10

模型 deepseek-flash，原生 Native Agent / Registry / Command / Transaction / Canvas；32次请求（含重试）、60万输入、6.4万输出授权上限。最终实际 **31次 / 543383输入 / 15351输出 tokens**；所有 usage 已知。参考图未外发。最后两次检查均在发送前因保守输入上界不足拒绝，未增加远程调用。费用预算未扩张。

首轮4次真实调用保留在 live：测试脚本未通过 manager.update 切换设置、独立 checker 读取了静态 fill 而非真实动画属性，且 READ 仍带无关契约。因此这轮计费但不纳入对照。修正后 live-fixed 使用真实开关、同任务、同模型/能力/输出上限；Task G 明确人为反转一份真实模型计划，不能当自然错误率。

|任务|WITHOUT SKILLS|WITH SKILLS|独立结果|
|---|---|---|---|
|A RGB→仅第二矩形紫色|通过|通过|3个实际UUID，Red/Blue保持；尺寸位置与颜色核验；两次事务均可Undo|
|B Cubic+中文副标题|通过|预算中止|真实可编辑Text、字体/字号/位置|
|C 径向渐变|通过|未发送/预算不足|真实填充/半径/PNG|
|D 位置动画/缓入缓出|执行完成但数值未通过|未发送/预算不足|模型把两个控制点拆到两个Keyframe，原实际中点不符；已加原生easing组合与离线中点回归，未完成修正后实测|
|E Gradient→Glow→Output|未通过|未发送/预算不足|错误portId被host拒绝，单任务planning=4耗尽；无正式写入。查询现已按元数据筛选，未完成修正后实测|
|F 修改背景保留文字动画|通过|未发送/预算不足|2层/文字关键帧保留/真实Undo|
|G 受控依赖错误|通过|未发送/预算不足|保留所有工作修复；属于注入，不是自然模型统计|
|H 复杂参考复刻|未测试|未测试|所配置DeepSeek无Vision；工具/Scene/视觉均未认证|

基础 A–F：WITHOUT 4/6 达到独立任务要求；不是所有基础任务通过。G 单列受控恢复 1/1。WITH 仅 A 为完整样本，B部分读取后被全局预算阻止，其他没有远程请求；这些不能算作Skill自然失败，也不能填入完整配对平均值。

唯一完整配对 A（含创建及后续改色，两会话）：WITHOUT/WITH 都完成，模型调用各4次；输入55104/57460，输出1898/2632；耗时9.12/12.16秒。n=1，未证明Skill提高成功率，该样本增加输入与耗时。保持指导小而有界，不归因底层修复为Skill收益。

真实执行指标由 Session trace、正式Scene和PNG生成，原始数据见 outputs/agent-010/metrics.json 与 live-fixed。成功基础样本 Command/Scene 验证通过，实际render有证据；独立模型视觉比较均 NOT_VERIFIED。A/F 独立目标及未新增多余对象已检查；未对全样本做任意隐藏变化的全面人工评分。恢复token不能从planning阶段混合调用精确分离，记录为未单独计量；不编造无意义零值。

采样量有限且配对不完整。没有其他供应商真实认证，也没有长期稳定率结论。继续完整配对/复杂视觉测试需要另行模型预算及可用Vision服务；本轮不擅自增加费用。

## Descriptive metrics (WITHOUT A–F only)

6任务/8会话：活动记录完成42/43（含READ与预检拒绝，不冒充模型schema准确率）；正式执行步骤22/22，已接受Command34个；Scene/Render验证7/8会话；独立视觉验证0/8（未验证，不等于视觉失败率）。平均每任务7.17活动、3.17模型请求、50257.67输入tokens、7.18秒。对象误改在明确审计A/F范围观察为0，未宣称全软件隐藏变更计数。恢复token未单独分离计量。详见outputs/agent-010/reliability-metrics.json。
