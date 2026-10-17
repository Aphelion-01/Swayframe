# V2_DRAFT_COMMIT_UX_REPORT

源码冻结：`066e172c23ecb7f24075d284eacc7b034f3dc36b`（父版本 `3c787b2`），分支 `codex/agent-v2-capability-unlock`，产品版本 `1.0.3`。

对象：Agent编辑模式；任务：自动化编辑与审阅；频率F5；上下文AssistantMode；固定域ASSISTANT；canonical assistant.actions。按DESIGN.md的紧凑参数/既有面板/无新增全局按钮规则实施。

- 用户先显式选择Core V2 Beta。模式默认“审阅后应用”，不擅自改全局默认。选择“直接编辑（可撤销）”只影响当前控制器UI状态，不写Scene，不增加历史。
- 普通创建/颜色/位置/旋转/尺度/关键帧/已接入安全参数：同原隔离Draft逐步执行、验证真实Scene+Renderer，再自动调用原accept。每轮一次Transaction，Undo/Redo不变。
- 效果移除、资产、结构、Mask、超过40步/20目标或用户明确要求预览：保留pending；正式Scene不变，显示原因及实际操作/PNG，需明确Accept。原资源上限100动作不等于直接模式阈值40。
- 运行或pending时禁止切模式及重复发送；可停止/拒绝。GUI改变、切工程、关闭助手使未接受任务取消。失败文本保留；直接成功才清除该次原输入，不清掉用户等待期间新写的内容。
- 自然语言“撤销刚才的修改”只撤销历史末笔仍匹配的上轮Agent事务；原生Undo失败不会显示成功，GUI插入历史后不越过GUI事务盲撤销。

Feature Placement Review：agent-v2-edit-mode已注册Feature+scoped Command，复用assistant.actions下拉参数；不再额外渲染同一模式按钮，永久全局按钮增量0。FEATURE_INVENTORY.md / FEATURE_LOCATION_MATRIX.md已更新。注册表测试包含在922项中。

UX heuristic内部检查：模式/阶段/失败可见；直接/审阅可控；危险删除可审阅和Undo；状态不只用颜色；下拉可键盘使用，任务中禁用；“第几轮”解释为用户发送次数。检查1280×720、1440×900、1920×1080、2560×1440的实际CSS视口，沿用原滚动侧栏和五区密度，不复制编辑器。小高度需要侧栏滚动。是内部检查，不是用户研究。

早期用setContentSize时macOS把高窗口限制在屏幕高度，未当作成功覆盖四种高度；最终用真实Electron CDP Emulation校验innerWidth/innerHeight，保留修正前报告，并输出准确尺寸PNG（deviceScaleFactor=1）。


证据目录：`docs/qa/v2-capability-unlock/`；执行脚本：`work/capability-unlock-qa/`。本轮付费 API 调用为0；离线输入不代表模型理解能力。历史 V2-7 报告及原始响应未改。

截图检查还明确激活助手页签并检查V2面板可见宽度，防止仅DOM存在但面板隐藏的假覆盖；修正前运行另保留electron-before-assistant-viewport.json。
