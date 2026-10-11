# Agent Test Coverage Gap

审计日期：2026-10-11；业务基线：0.9.26，Git 快照 `bd2d82ca11db0f3327ad1d77cd16d7c21bcc4eb7`。
诊断分支：`codex/diagnose-0.9.26-20261011-124555`。原工作区、未提交修改和现有工程均保留。本轮未修改业务实现。
证据等级：CONFIRMED=代码及受控/真实运行证据；SUSPECTED=有依据但缺因果验证；UNVERIFIED=未验证；NOT A PROBLEM=在明确测试范围内正常。用户原始调用缺日志时另标 UNCONFIRMED。

## 实际基线与计数口径

本轮重跑：144文件、566测试全部通过，原始Vitest JSON `outputs/deep-agent-audit/baseline-tests.json`。逐文件测试名、分类、标签保存在 `coverage-inventory.json`，可以重算。

| 互斥主分类 | 测试数 | 能证明什么 |
|---|---:|---|
| Editor/core/IO/runtime | 464 | 对应编辑/动画/Graph/文件/效果算法的断言，不是全部Agent验收 |
| Agent相关 | 86 | Registry、Planner、scope、事务、部分真实Command与mock编排 |
| Provider / AI infrastructure | 16 | 受控协议/设置/安全/路由等，真实网络0 |
| 总计 | 566 | 已有断言通过；不是566次独立真实Agent创作 |

以下为**文件级重叠候选计数**：将具有某标签的文件内测试数量加总，标签可重叠，不能称对应数量测试均包含该断言：Mock Provider候选52；多步fixture候选26；快照断言候选393；real Command import候选170；UI/jsdom候选264；像素断言候选7。没有伪造“精确多少测试证明真实Scene变化”，完整自动断言语义分类需要进一步逐测试人工标注。

real Tool/Command-heavy文件组：agent-compositing-tools3、fill-reliability3、agent-tools2、write-tools3、text-reliability4、transaction3、semantic-plan1、effect-forge-agent2，共21；creation7后28。属于文件组统计，不保证每一条同时覆盖真实参数、Scene、图像和目标。

## Mock Passing 与真实缺口

- `tests/agent-orchestrator.test.ts` 模拟 runtime.validate、execute、commit：可证明编排状态，不证明工具输入可执行。
- `tests/agent-vision.test.ts` mock getContext/toDataURL；`tests/agent-v1-acceptance.test.ts:297–308` mock Canvas：没有验证实际视觉渲染输出。
- 像素候选7分别位于 compositing-render1（模拟Canvas）、effect-library3（纯像素runtime）、radial-gradient3（纯算法）。纯算法测试真实且有价值，缺的是端到端实际Canvas，不应全称为假阳性。
- 566中真实Provider调用=**0**。完整Native Agent→unmocked原生Canvas端到端=**0**（已核查Agent视觉与验收路径）。重复真实同任务=0。
- 多步fixture不覆盖“READ后动态参数无效→执行纠错→重放→一次提交”；add→update同keyframe复合后置验证也未挡住现有漏洞。
- 以前宣称basic可运行，不能扩大成参考图复刻达标。视觉模型说通过也需要实际截图/Scene/用户目标核验。

## 本轮新增独立验证（不冒充已有CI）

| 验证 | 数量 / 结果 | 边界 |
|---|---|---|
| 普通UI A | 10类操作观察成功 | 一个隔离工程；DOM/截图，缺独立完整Scene导出 |
| 独立正式Command B vs Adapter C | 10/10；原生PNG各对完全一致 | GaussianBlur默认0；不是全效果/3D覆盖 |
| DeepSeek文字/径向填充/矩形/关键帧 | 4×3=12，全部完成 | 独立临时合成，简单明确任务 |
| DeepSeek位置/缩放/旋转/效果/节点/连线 | 6×1=6，全部完成 | 不作重复稳定性估计 |
| 实际Scene / Render / Undo | 18/18状态目标、18 PNG、18/18 Undo | 人工粗目标判断；非参考图相似度验收 |
| Provider请求 | 37，错误0 | DeepSeek-flash，流式关闭、图片关闭、无跨Providerfailover |
| 参数/预检/执行恢复/HTTP/SSE/最终态边界 | 9个确认问题 | 多数受控构造，不说是用户原始调用 |

真实Provider消耗1,745,112 tokens，其中input1,731,719。没有账户金额。LIVE任务已获用户授权，日志无API Key、用户图像/工程。无需为补报告重复支付调用。

## 需要新增的有效测试

| 缺口 | 应有断言 | 合格标准 |
|---|---|---|
| 动态Fill契约 | schema/runtime能力参数、目标类型、center/stops/radius范围 | 所有正式合法参数保持兼容，非法参数执行前报字段，不偷偷coerce |
| 分阶段预检 | READ后确定性写入、前序新建层、Forge产物依赖 | VERIFIED/DEFERRED可解释，实际草稿阶段校验，不伪造对象 |
| 执行修正 | 第一次错参数/过期ID，第二次变更参数；重复同错/取消 | 有限模型调用、参数确实更新、正式Scene无部分变化、一次提交Undo |
| 组合结果验证 | add→update→remove同ID及多属性覆盖 | 验证最终态，合法事务不误拒绝；错误结果仍拒绝 |
| Error envelope | schema/compile/HTTP/Renderer/Provider不同失败 | field、received、cause、phase、recoverable完整，不截半个JSON、不泄密 |
| Provider兼容 | HTTP4xx正文、SSE多调用/断块/缺DONE、finishlength、超时 | 半截结果永不执行；按类型有限重试；4服务fixtures及授权live各单列 |
| 状态并发 | 新层READ、切合成、用户编辑期间commit、取消 | 草稿可见且正式基线保护，拒绝覆盖，不重复创建 |
| 实际视觉 | 非零blur、径向填充、路径绝对handle、Graph接Output | actualCanvas像素/截图及目标状态同时验证 |
| 复杂创作 | Cubic参考复刻与依赖/多步动画 | 初稿与每轮修正的Scene/图像/预算保留，人工视觉或明确独立规则验收 |
| 持续可靠性 | 多种简单任务独立重复，固定模型/config及日志 | 任务成功、工具成功、渲染/视觉成功率分别计数；不以单轮胜率外推 |

## 推荐门禁

默认离线CI覆盖上述受控失败与真实Command/Canvas；付费live回归为授权且有额度的独立门禁，不混入默认566。视觉基准按目标与场景制定，失败不得以“有图/有层/Provider说成功”替代。修复前保存失败fixtures；修复后对比同一业务基线与新实现，禁止先改实现再倒推原故障。
