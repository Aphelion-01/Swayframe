# 真实编辑器集成

AgentPanel 既有入口内提供 Legacy V1 / Core V2 Beta 选择，V1默认。V2 使用当前正式 EditorStore，已不局限于 AgentV2Lab。Plan→Execute→Verify/Render→Preview→Accept/Reject/Cancel 已接入。正式写入仅发生在用户接受后；每轮完整事务可撤销。

输入失败、拒绝和取消时保留。关闭助手停止未接受任务；切换引擎丢弃未接受草稿。GUI、Selection、Project、Composition 更改停止当前草稿并保留用户正式修改。两个引擎不能同时写工程；不默默回退 V1。前轮已提交结果不会因后轮失败被清除。

状态直接来自 TaskRuntime，每80ms刷新显示实际阶段/已完成步骤/本轮序号；这只是订阅，不是第二任务状态机。开发者诊断包含运行路由、task/turn/session、步骤身份、预算、requests、usage、恢复方法、验证与像素统计；省略 goal/文字/Scene/模型原文/图片/密钥。前置引用失败没有伪造的完成状态，不篡改旧轮次诊断。

入口登记：agent-runtime-choice / agent-v2-new-session，ASSISTANT，Application，Automate，F5，AssistantMode，canonical assistant.actions。agent-export-diagnostic 复用已有登记。CommandRegistry / scoped Command / typed contribution 复用；Feature 元数据无回调，不改全局工具栏。FEATURE_INVENTORY.md / FEATURE_LOCATION_MATRIX.md 已更新。

证据：tests/agent-v2-editor-ui-v27.test.tsx（真实 AgentPanel，3场）；work/agent-v2-7/editor-renderer.tsx（实际 App，包含图层/属性/画布/时间轴/助手），outputs/agent-v2-7/editor/report.json。仅 Provider 返回采用固定离线 Fixture，非真实 LLM 结果。第二 Electron 进程读取磁盘工程继续同ID编辑见 restart-report.json。

明确选中的3D/摄像机/模型在Provider请求前停止并提示切换V1，不把2D位置修改冒充3D控制。
