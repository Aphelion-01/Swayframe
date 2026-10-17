# Agent Core V2-6 Implementation Result — Swayframe 1.0.2

结论：Phase0～5完成，真实付费验证与缺陷修复已收尾；Phase6评估仍为NOT READY。首轮七场4通过/3失败，L3提交缺陷修复后原响应离线重放及1次真实复测通过；两场V1对照失败保留。没有正式切换默认Agent。独立开发分支 `codex/agent-v2-recovery-1.0.2`，基线801008a，历史1.0.1和原用户未提交修改保留。详见 `AGENT_V2_6_LIVE_VALIDATION_REPORT.md`。

## 16项必答

1. 支持真实参数Schema失败、有限typed引用/草稿stale/写前拒绝、Provider错误分类、预算/取消/基线冲突/写后不确定停止，详见 Recovery Architecture。
2. 确定性：重读当前草稿、唯一已验证result ID重解析、明确写前可恢复拒绝。无实际ID或不存在目标不能猜测修复。
3. LLM：仅失败动作参数，实际Registry复验；局部有界摘要、不重建计划。
4. 必须停止：权限/能力/依赖、丢失目标、正式base变化、写后不确定、取消/超时/超预算、不可解析Provider响应、违规改目标和重复非法候选。
5. 已完成steps/resultMap/currentdraft保留，不重放成功前缀；失败可安全只读检查，不允许部分草稿冒充完成。
6. 当前同一Runtime内有重放护栏，三类非幂等写后故障均停止；未实现跨重启exactly-once，不能保证所有未来情况绝无重复。
7. 60次固定离线长链及实际Renderer使用真实ID绑定；live V2恢复保留成功输出。V1模型遗漏propertyId实际失败保留，不冒称所有引用都可靠。
8. 离线样本和live恢复样本未发现状态失同步；live发现提交标题越界并修复，不外推到任意用户长任务。
9. 离线25次确定性恢复尝试+27次fixture模型参数修复尝试；live另1次确定性+1次真实模型局部修复；4次显式Provider重试fixture另计。统计组不合并为独立自然任务。
10. 离线确定性恢复成功25次；live确定性恢复1/1，仅一个样本。
11. fixture模型修复成功21次；live模型局部修复1/1，仅一个样本。L3重跑不算局部恢复。
12. 失败路径无正式Commit，正常成功接受一次共享Transaction；用户base变化保留新修改，隔离Lab不接收原用户EditorStore。
13. 去除相同非法候选循环和整计划/成功前缀重放，缩小修复Schema/上下文；未知计费不记0。实际live成本优化尚未验证。
14. 本轮真实API请求11，113767输入/11608输出tokens，未知用量0；V2-5历史16请求不算新增结果。完整失败和累计账本保留。
15. 真实小规模恢复/长任务已有证据，但公平重复样本、完整V1体验和受控用户验证不足，正式Canary NOT READY。
16. 正式替换V1条件不足，默认仍V1。

## 实际验证

- Phase0～5分别完成 typecheck、lint、tests、build、desktop build，最终781/781 tests。历史初次失败日志保留，真实提交缺陷新增两项回归后通过。
- 26个故障边界测试、27记录；R1～R8全部真实触发预定安全结果。
- 3个16/12/12动作固定任务各20次，合计60离线重复；39故障触发，0意外正式修改。
- 离线7场实际Native V1/V2 Electron /21 PNG全部通过。真实首轮7场4通过/3失败、21 PNG保留；L3原响应离线重放及独立真实复测各3 PNG通过，禁止与首轮合并成全部通过。
- 按 DESIGN.md 的现有 ASSISTANT入口、颜色/密度/滚动规则调整隔离Lab；4尺寸与失败前缀真实窗口通过。没有新增永久工具栏按钮或功能域。

所有证据在 `outputs/agent-v2-6/`，包含 offline-summary、fault/long records、Electron trace/Scene/PNG、各Phase质量及UI。七报告拆分记录架构、故障、长链、对照、成本、Canary及总结果。

安装包含本轮提交修复：`release/Swayframe-1.0.2-arm64.dmg`、`release/Swayframe Setup 1.0.2.exe`。Mac实际程序独立配置启动、包内界面/V2 ESM加载及DMG校验通过。Windows仅NSIS构建，未实机验证；两端未签名。最新校验和及保护复核见 `outputs/agent-v2-6/RELEASE_MANIFEST.json`。本轮授权最多20 requests /400000 input/40000 output，实际11次，未发送图片。


初次UI诊断序列化错误及最终截图fixture误用fill字段的失败与修复另保存在 `outputs/agent-v2-6/development-failures.json`，严格契约未被放宽；最终截图与完整测试通过。

## 离线复现

在本工作树运行 `node work/agent-v2-6/gates.mjs phase4` 完成质量门禁；`node work/agent-v2-6/build.mjs` 生成测试脚本；`node_modules/.bin/electron work/agent-v2-6/main.cjs` 运行七场离线集成；`node_modules/.bin/electron work/agent-v2-6/ui-main.cjs` 检查隔离窗口。默认全部离线，不读取真实凭证。不要将离线报告生成器用于真实live账本，也不要重新使用V2-5授权；真实入口要求新增V2-6授权文件和独立预算，已有live账本禁止覆写。
