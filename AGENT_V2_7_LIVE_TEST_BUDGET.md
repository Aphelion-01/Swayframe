# LIVE_TEST_BUDGET_PROPOSAL / V2-7

状态：原授权使用8次请求（7配置拒绝+1目录），追加授权20次已全部使用，总计28次。新增轮20/20请求、核算输入336710/400000、输出13425/40000；每次最大输出2000，A6/B5/C3/Matched6。实际完整Token和费用未知：17条usage已知，11条未知保守预留，不能按0。SF测试默认模型和规划路由已按补充授权改为deepseek-v4-flash。新增预算仅对应authorization-round2.json，不自动续用。

经本轮补充授权，固定学校代理 https://model.jsnu.edu.cn/v1/chat/completions / deepseek-v4-flash / tools；不自动换模型、协议或服务，不发图片/私人工程。使用独立测试工程、当前真实EditorController / TaskRuntime / Registry / Scene / Renderer，每轮Preview后明确接受，记录失败而非挑成功。

| 测试 | 正常请求 | 最大请求（含恢复） |
|---|---:|---:|
| Session A：三矩形→第二填充→其动画→第三位置 | 4 | 6 |
| Session B：Cubic→字体/色/位置→副标题→透明度动画 | 4 | 5 |
| Session C：渐变图形→GUI移动→Agent继续（后两者一轮API） | 2 | 3 |
| 同一初始工程的V1/V2填充、尺寸、字体三配对 | 6 | 6 |
| 总计 | 16 | 20 |

总上限20次实际请求，含重试、恢复、READ检索；累计input最多400000 tokens、output最多40000 tokens，单请求maxTokens=2000。真实模型reasoning占用也按Provider usage计入。一次请求前预留序列化输入的保守上界及最大输出；usage未知保留上界，不按0计算。每场不借用其他场恢复额度，总授权上限优先；达上限或剩余预算不够预留即停止，不提高额度。正式设置/素材不修改。

冻结条件：同模型、同协议、同WRITE子集、同初始Scene/goal/scope、同maxTokens/单场请求上限。V1额外READ仍记入实际次数/Token，不截断展示；Matched与Full Product结论分开。

停止条件：任何意外正式写入、对象引用越界、不确定写后错误立即停该Session；取消/配置变更/401/403/无预算停止请求；无无限恢复、无自动Provider failover。每请求timeout最长90秒、整体最长30分钟。若Schema超预算或响应截断，记录失败，不自行调高输出限制。

费用：学校代理已经用户单独授权，官方费用估计不适用，学校实际费率未知，不声明费用上界。本轮请求数及Token硬上限保持不变。原官方方案依据2026-10-13的[官方价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)估计满额0.56～1.12元，只保留作为原方案记录，不用于学校代理计费。

验收留存真实测试输入、返回与Scene只限独立测试工程；产品脱敏诊断不外泄这些。每场报告各轮成功/失败/恢复、正式UUID、Undo/Redo、像素、输入/输出/未知usage、请求类别与额外费用。实际外部请求累计28（旧8+新增20），完整Token/计费未知，记录LIVE_REQUEST_USAGE.json。正式桌面测试宿主live-product-host.ts使用正常SDK，修正/重放不增加API账本；捕获重放单独标注。活动执行最长30分钟，跨复测累计，不包含等待授权及离线修正/构建。最后scope实测活动累计1733903ms。输入/输出尚余63290/26575但请求余额0，不能继续发请求；完整A/B和动画验收需另获授权。执行脚本硬拒绝自动覆盖/重放已存在账本或提高限额。

## 2026-10-14 冻结版本第三轮授权与结算

用户“继续验收”批准既定20请求/400000输入/40000输出/每次2000方案，独立工程、无图片。学校deepseek-v4-flash，总上限48请求；本轮A5/B4/C2/Matched9，同对照variant最多2次，READ计入。原28条SHA及授权记录见 authorization-round3.json。

实际11次：A1/B1/C2/Matched7，88117输入、4921输出，未知usage0。累计39次，历史未知11条仍预留。剩9次请求未用，原因是A/B前置创建失败，未用重复抽样伪造完整验收。无费用估计或新增自动授权，剩余额度保留在账本，不将其算已消费。
