# 独立 V1/V2 对照

在 1.0 工作树执行 `node work/agent-v2/build.mjs`，再执行 `node_modules/.bin/electron work/agent-v2/main.cjs`。需要桌面运行权限。所有工程为独立生成的测试工程；无 credential、HTTP、API 或用户图片端口。

先检查 `outputs/agent-v2/benchmark/`；重复运行前应给输出更换独立目录，不能覆盖保留的失败证据。正式基线使用首次最终的 report.json。

V1 调用原 `createNativeAgent` 与正式 Registry/Transaction；V2 调用新 Planner、ProviderBridge、TaskRuntime，并注入同一正式 AgentSnapshotRenderer。模型响应是固定 fixture，不是 LLM。B5 故障在 Add Effect 写入之前注入。恢复只返回失败动作/步骤，禁止重复创建。

开发接口：`createIsolatedCoreV2({isolatedProject:true,host:independentCommands,registry:existingRegistry,scope:{compositionId,existingLayerIds:[],allowCreate:true},renderer,requireRender:true,repair:(action,error,signal)=>planner.repair(action,error,signal)})`。先 `planAndRun(goal,planner)`；验证后处于 AWAITING_ACCEPTANCE。宿主明确接受才调用 `accept(proposalId)`。禁止传入普通编辑窗口的活动工程；当前未提供正式 UI 切换入口。

源码是 runner 的可审查部分；renderer.js 为生成文件，不纳入 Git。所有前三轮失败记录留在独立输出目录。最终 runner 门禁要求 V2 全通过且任何路径均无意外工程修改；不隐藏 V1 B5 拒绝恢复的失败。
