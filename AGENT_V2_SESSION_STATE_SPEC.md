# Continuous Session State

ConversationSession 是会话元数据，TaskRuntime 是本轮执行事实，当前正式 Project 是对象存在性和属性的唯一来源。草稿 result references 只由当前 TaskRuntime 持有；跨轮次只提升已 Commit 的真实 layer UUID，不延用 stepResult。

提交：仅 COMPLETED 且有 transactionId 的任务更新 recentlyCreated/recentlyModified、lastAccepted、动画真实 keyframeId。Reject/Cancel/FAILED 不提升对象。GUI 提交通过 EditorStore 订阅观察；每轮重新求值位置、透明度、填充、字号，以及有限关键帧摘要。删除/Undo 的引用保留身份，但判定失效，不能自动重建。

验证顺序：project→composition→对象存在→实际类型→locked→授权 scope。目标多个且不明确时要求用户选择；不选择相似名字。对象序号优先本会话已提交创建顺序，无元数据时使用当前图层列表顺序。保存同一工程并重载后验证原 UUID；真正重启不持久化 Session 元数据，可以通过选择或当前唯一对象继续，不恢复未完成任务。

内存边界：最多保留最早100个已提交创建身份，不静默重排第一/第二个对象；第101个及之后须显式选择。最多20个授权目标，位置/透明度关键帧各摘要20个并标注 truncated，不能将摘要缺失解释为对象不存在。诊断保留最近100轮；完整账户累计用量仍由已有 AIProviderManager 管理。正式 Scene 内容不写入会话副本。

“撤销刚才的动画，保留渐变”是有限明确的语义操作：必须对应当前历史末笔、上一轮实际新增的 position/opacity 关键帧；同一 TaskRuntime 执行 deleteKeyframe，新的 AgentTransaction 可再 Undo。非最后历史或无法证明归属时停止，不盲目 Undo 用户修改。

tests/agent-v2-session-v27.test.ts 与 tests/agent-v2-boundaries-v27.test.ts 覆盖引用、GUI刷新、锁定、删除、Undo、重载、类型/合成、拒绝、迟到响应、Session隔离与100对象边界。

编辑器事务捕获真实播放头时间；未指定time的属性编辑及Renderer使用该时间，显式time覆盖。隔离调用默认仍为0秒。中文序号仅支持一至十；其他中文序号明确要求数字或选择，不将“十一”误解为“十”。
