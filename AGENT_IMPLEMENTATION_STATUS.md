# Native AI Agent V1

## Architecture
基线：docs/baseline/NATIVE_AI_AGENT_V1.txt。A0→A14顺序实施。
ProviderManager为应用服务，设置/用量/Skills/历史独立于Project，密钥仅原生加密存储。Orchestrator消费结构化Plan，Registry校验权限并适配共享Command；隔离CommandSystem执行/渲染/验证，真实工程仍为同一基线才一次提交，一步Undo。Intelligence仅输出Proposal。

## Completed
- 上一轮0.8.0：3a6e90e，227测试与18阶段门禁通过。
- A0审计：现有Agent为固定Mock演示，无Provider/应用设置/密钥服务。保留既有Command、Renderer、Graph与Property。

- A0、A1全门禁通过：234 tests / 84 files。Settings服务CRUD、默认服务、连接测试、模型能力；原生异步safeStorage，开发Web仅内存凭证。

## In Progress
- A2：Session / Plan / Orchestrator / Cancellation。

## Blockers
- 真实第三方API验收需用户自行配置凭证，不阻塞Mock与协议测试。

## Tests
各阶段日志：outputs/quality/A0.log ～ A14.log。未运行阶段不得标为完成。
