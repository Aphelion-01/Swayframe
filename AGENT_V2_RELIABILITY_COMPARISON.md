# V1 / V2 分开比较

## Matched Capability Subset（OFFLINE）

实际 native V1 与编辑器 V2，相同初始Scene及UUID、选中对象、请求目标、Fixture Provider、tools模式、合成时间及隐私设置。V1保留真实READ；WRITE限制到同13工具，并在真实Transaction执行处再次限制。V2使用同Registry Command与真实后置验证。

三组配对：填充、宽高、字体。V1 3/3、V2 3/3，各1次Fixture请求；非目标图层不变，无新增/重复对象。jsdom渲染替代单列；真实Editor渲染由另一个Electron工作流验收。原始结果 outputs/agent-v2-7/matched-offline.json。

序列化请求长度（JavaScript字符串字符数，不是Token）：V1约28.9k /28.9k /32.5k；V2约53.8k（补充当前属性摘要后重新生成的文件为准）。Fixture固定100 input /50 output只是合成测试数据，不是可用于成本比较的实际用量。当前V2完整动作Schema仍较大，不宣称Token下降或整体优于V1。

初次V1测试Fixture缺必需steps.label，正确被原Schema拒绝；保留boundaries-debug.log，修正Fixture，不放宽Schema。单轮三个配对不足以证明长期稳定性。

## Full Product Experience

V1仍是正式默认，具有已存在的READ、Skill、参考图、Forge、效果与复杂节点能力。V2 Beta目前只迁移基础图形/文字/填充/尺寸/字体/位置/透明度/关键帧/单模糊实例。连续会话安全工作流离线完成，未迁移能力明确展示，不默默降级。

真实学校模型对照：填充V1/V2原响应在修正验收后捕获重放通过；V2尺寸、V1/V2字体新鲜API实际通过；V1尺寸发READ后受原单场限额阻止后续请求。完整三个配对、公平完成率与额外READ成本尚未成立，不能宣称V2优于V1。填充重放不是新API，也不当作新的模型成功样本。

后续V2规划文档/作用域投影发生修复，前后结果需分开，不将旧对照与新版本混成一致冻结版本结论。新鲜三矩形、选中原第二层改紫、实际标题/复合文字属性、GUI续改有通过证据，完整同一会话/动画仍未完成。原8+新增20共28请求，完整Token未知，细节见AGENT_V2_7_LIVE_PROVIDER_REPORT.md。默认V1、Canary NOT READY；新付费复测必须单独授权。
