# Agent Execution Recovery Result — 0.9.28

代码修复与离线质量门禁完成；完整重复 Provider 验收待预算授权。0.9.27、原工作区和未提交修改保持不变，开发在 `codex/object-reference-recovery-0.9.28`。

| 必答问题 | 已确认答案与证据 |
| --- | --- |
| 无效 UUID 的真实来源？ | 找到真实失败会话摘要；原参数/Trace未被旧历史保存，因此当次原值与来源无法证明。见 historical-evidence.json；不使用受控 marker 冒充。 |
| 模型生成还是工具返回误用？ | 历史证据不足以区分。受控旧版创建返回没有显式 layerId，后续非法字面值被 schema拒绝。见 baseline-before-after.json。 |
| 创建结果可靠传递？ | 新版从实际 Draft 新增对象返回 ID，Transaction 按 Step 绑定，两个图层实际 DeepSeek Trace与 Scene分离验证通过。 |
| Step Result Binding 存在？ | 已实现于 object-reference.ts / transaction.ts；不进入 Scene。 |
| Draft 恢复 ID稳定？ | 同一存活 Draft 的已完成结果保留；新 Draft 必须重新绑定其真实新 ID。旧 ID不冒充稳定。TEST 11覆盖。 |
| 类型是否验证？ | Layer、Node、Property等按真实索引校验；类型、合成与能力分阶段检查。TEST 05及错误分类测试覆盖。 |
| 为什么错误出现两次？ | 历史调用 Trace缺失，无法确认当次原因。已修复可复现的重复计划记录顺序，专业建议重复参数也不重复预验证；实际执行预算与成功步骤重放保护保留。 |
| 为什么记录显示参考图结构分析？ | 原生 READ 返回 Proposal后的工具校验抛出，错误由分析 READ外层 catch记录；新版在纠错循环捕获并关联失败 Step/Tool/preflight。native-agent-panel回归覆盖。 |
| 哪些工具有同样风险？ | ID输入的 Layer、动画、Effect、Graph、Mask、Parenting、Asset工具；统一接入注册边界，原命令实现保留。创建输出字段专门排除已有目标解析。 |
| 修了哪些源码？ | 详细清单见 AGENT_OBJECT_REFERENCE_AUDIT.md；没有另建Scene、Renderer或Electron。 |
| 回归是否通过？ | 614测试，lint/typecheck/desktop:build通过，证据在 outputs/object-reference-028。 |
| 真实 Provider结果？ | 3次受控请求：2项完整通过，1项漏动画。另两类及完整重复批次尚未测；详见 TEST_REPORT及 live-review.json。 |

安装包仍按用户要求生成 Mac arm64 与 Windows x64。构建结果、哈希与运行冒烟记录保存在本轮 outputs 与 release。Mac 未签名；Windows由 macOS交叉构建，不能替代 Windows实机验收。

本轮修复的核心是确定性对象引用、安全的逐步执行与恢复。模型任务遗漏仍需诚实单列，不能用成功解析某个 ID来声称整个创作任务完成。


## 安装包终检

Mac arm64 DMG 与 Windows x64 NSIS EXE 均已构建成功，大小和 SHA256 见 `outputs/object-reference-028/installers.json` 与 `release/Swayframe-0.9.28-SHA256.txt`。Mac 包的主程序、preload 与 renderer 在隔离 profile 中成功启动，新建工程并显示画布；无加载失败或渲染进程退出，截图已检查（`packaged-smoke.json/png`）。Windows只完成交叉打包，没有 Windows实机运行证据。

原始工作区542项业务文件、HEAD、分支及索引与发布前保护清单一致（`original-workspace-protection.json`）。安装包尚未宣称完整重复Provider验收通过。
