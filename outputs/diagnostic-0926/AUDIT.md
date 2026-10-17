# Swayframe 0.9.26 独立诊断审计

日期：2026-10-11。基线：`bd2d82ca11db0f3327ad1d77cd16d7c21bcc4eb7`。
分支：`codex/diagnose-0.9.26-20261011-124555`。

## 范围与隔离

本轮审计 Agent 工具预检/结果校验、原生填充、媒体解码边界与验收口径。产品源码、安装包和原工作区均未修改，没有真实模型网络调用。依赖通过本地 node_modules 链接复用，不重新安装。探针只操作独立内存工程。

## 发现

1. **P1 验收缺口：真实参考复刻仍未通过。** `AGENT_VISUAL_QA_RESULT.md` 明确记录 0.9.24 的 Cubic 最终视觉失败，0.9.26 只完成本地原生填充验证，未完成真实 B/C 重跑。不能据 566 项测试通过认定 Agent 核心视觉目标完成。
2. **P2 可复现：径向参数预检与结构化诊断不完整。** `setFill(radialParameters.radius=-1)` 被 permission/preflight schema 接受为 WRITE；直到 compile 的 `parameterError` 才拒绝，错误类型是 tool_failed，且没有 details.issues。证据：`boundary-probe.json`。位置：`src/agent/write-tools.ts:589`、`:654`。建议从共享参数定义派生字段校验，或将编译校验错误转换为同一结构化字段诊断；不放宽参数范围。
3. **P2 可复现：结果校验误拒合法复合关键帧命令。** 同一命令批次先 keyframe.add 再 keyframe.update，CommandSystem 事务成功，但 verifyResults 最后仍拿新增时的旧帧与最终帧比较而报错。证据：`boundary-probe.json`。位置：`src/agent/tool-registry.ts:355`、`:377`。建议按命令顺序合并最终期望值。探针证明通用 verifier 边界有缺陷，尚未证明现有某个用户工具必然生成这种命令组合。
4. **P2 静态风险：音频内存预算属于解码后检查。** Web Audio 在 `decodeAudioData` 返回后才核算 PCM 内存。256 MB 输入大小限制不能限制压缩音频解码过程的峰值；大文件可能先占用大量内存再被拒绝。位置：`src/importers/audio-decode.ts:15`、`:22`。本轮未进行大内存压力实验，不将静态风险写成已复现崩溃。

## 验证

- 独立工作区完整测试：144 文件，566 项通过。
- typecheck、lint：通过。
- 初次 lint 扫描到本轮生成的探针 bundle，产生 168 条工具产物告警；将自建探针放到已有 work 临时目录后，原规则 lint 通过。未修改 lint 规则或产品代码。
- 完整测试会更新诊断工作区的 outputs/timeline-ux/performance.json；该统计变更没有进入审计提交，原工作区对应文件未受影响。
- 两项本地边界探针：已复现，结构化记录见 boundary-probe.json。
- 原工作区未提交内容、暂存区、分支和 HEAD 保持不变；备份源码 ZIP 的 1688 个文件与 Git 快照逐文件匹配。
- 没有重新声明真实 Provider、Windows 真机、物理景深或长期内存验收通过。

本报告只作诊断，不合并任何修复回当前版本。
