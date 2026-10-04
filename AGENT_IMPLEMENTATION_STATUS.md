# Native AI Agent V1

## Architecture
基线：docs/baseline/NATIVE_AI_AGENT_V1.txt。A0→A14顺序实施。
ProviderManager为应用服务，设置/用量/Skills/历史独立于Project，密钥仅原生加密存储。Orchestrator消费结构化Plan，Registry校验权限并适配共享Command；隔离CommandSystem执行/渲染/验证，真实工程仍为同一基线才一次提交，一步Undo。Intelligence仅输出Proposal。

## Completed
- 上一轮0.8.0：3a6e90e，227测试与18阶段门禁通过。
- A0审计：现有Agent为固定Mock演示，无Provider/应用设置/密钥服务。保留既有Command、Renderer、Graph与Property。

- A0、A1全门禁通过：234 tests / 84 files。Settings服务CRUD、默认服务、连接测试、模型能力；原生异步safeStorage，开发Web仅内存凭证。

- A2全门禁通过：238 tests / 85 files。结构化Plan、ASSIST/AGENT、运行时危险操作确认、Stop、受限验证循环及过期工程拒绝。

- A3全门禁通过：240 tests / 86 files。相关工程摘要、选区属性和预算控制，素材不发送路径或内嵌内容。
- A4全门禁通过：242 tests / 87 files。12个typed读取工具；规划读取最多4轮/12次，动态读取后才提交Plan。

- A5全门禁通过：245 tests / 88 files。Layer/Transform/Text/Shape/Animation/MotionCurve/Effect工具复用共享命令；非授权素材拒绝。
- A6全门禁通过：248 tests / 89 files。隔离事务、500命令上限、一次提交/Undo、Stop丢弃、当前工程冲突拒绝、保存重开。
- A7全门禁通过：251 tests / 90 files。真实Agent面板、配置入口、计划、Activity、确认/Stop/Undo；实测浏览器无Provider状态，Mock面板→原生Controller→真实Scene/Renderer输入测试通过。已修正首次ASSIST被默认模式覆盖的问题。

- A8全门禁通过：254 tests / 91 files。8个内置Skill，用户创建/修改/停用/复制/导入导出；工具白名单执行约束。切换模式/Skill会取消旧待确认计划。

- A9全门禁通过：257 tests / 92 files。共享Graph节点/连接/参数、六个可渲染Mask工具、合成管理和已导入素材引用；保存与单步Undo验证。

- A10全门禁通过：260 tests / 93 files。共享Canvas2D真实低分辨率渲染、renderFrame、视觉结构化Proposal、前后预览、受限修正；缺视觉模型/禁止发送时如实显示本地检查。

- A11全门禁通过：263 tests / 94 files。用户选择图片/GIF首帧/视频3帧、参考chips/移除和五种模式；Layout-only权限限制、隐私关闭不发送像素、无Project Asset写入。

## In Progress
- A12：Failover、Usage、Routing、Privacy 设置。

## Blockers
- 真实第三方API验收需用户自行配置凭证，不阻塞Mock与协议测试。

## Tests
各阶段日志：outputs/quality/A0.log ～ A14.log。未运行阶段不得标为完成。
