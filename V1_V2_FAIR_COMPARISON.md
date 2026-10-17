# V1_V2_FAIR_COMPARISON

源码冻结：`066e172c23ecb7f24075d284eacc7b034f3dc36b`（父版本 `3c787b2`），分支 `codex/agent-v2-capability-unlock`，产品版本 `1.0.3`。

**只验证共同能力的执行一致性，不是模型规划胜负。整体仍 CAPABILITY MISMATCH。**

相同源码版本、同一序列化初始工程（同目标UUID/位置/外观）、相同用户任务、OFFLINE FIXTURE Provider/model=fixture、无Selection，两者保留自己的Planner/Runtime/执行路径。未把V1 Planner复制到V2。分别提供契约正确的受控响应，故“模型语义正确率/实际token/费用”不可统计。

配对任务：fill红色、scale=(1.5,1.5)、rotation=45。每对真实输出RGBA逐字节相等；所有6次操作有真实Scene变化、Undo恢复完全相同初始Scene、Redo/保存重读逐字节一致、无额外对象、无非目标污染。V2使用用户显式直接模式；V1使用原Preview/Apply，需要一次Accept。

| 任务 | 引擎 | 额外Accept次数 | 毫秒（含本地验证/输出，不含模型） | fixture调用 | 执行结果 |
|---|---|---:|---:|---:|---|
| fill | legacy-v1 | 1 | 372.7 | 1 | PASS |
| fill | core-v2 | 0 | 138.3 | 1 | PASS |
| scale | legacy-v1 | 1 | 345.7 | 1 | PASS |
| scale | core-v2 | 0 | 135.0 | 1 | PASS |
| rotation | legacy-v1 | 1 | 349.0 | 1 | PASS |
| rotation | core-v2 | 0 | 135.8 | 1 | PASS |

三组均PASS；额外对象0，Scene污染0，Undo异常0，重载失败0，RGBA差异0。样本仅3组，时间包含原V1视觉流程和UI调度，不能推断V2模型更快、更便宜或普遍更可靠。Usage=100输入/50输出只是fixture合成数据，实际LLM tokens记null。

双方工具目录原样保留在capabilities.json和electron/report.json：V1 117项（含READ/Forge/语义别名），V2 44个可执行工具，另有宿主驱动原生READ。不把READ目录差异误算模型失败；全图、库、组合成、复制/删除等尚未对齐，不能用这三项成功说完整能力相等。

模型配置可比边界：此次没有模型；相同Provider/model字符串及语义目标只证明受控执行一致。实测requestSettings：V1请求未设置maxOutputTokens（null），V2为6000，二者responseMode均tools；没有额外更改V1默认配置。没有真实请求上限/温度/上下文完全匹配的Live证据，不宣称满足完整模型公平对照条件。新Live必须明确同服务、模型、初始工程、输出上限和Stop条件后单独验收。


证据目录：`docs/qa/v2-capability-unlock/`；执行脚本：`work/capability-unlock-qa/`。本轮付费 API 调用为0；离线输入不代表模型理解能力。历史 V2-7 报告及原始响应未改。
