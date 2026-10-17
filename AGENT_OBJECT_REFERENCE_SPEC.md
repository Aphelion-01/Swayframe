# Agent Object References 0.10

保留原 resolver 与 StepResultMap。引用支持 existing{id}、selection{objectType:layer}、stepResult{stepId,output}、graphNode{nodeId}；正式属性/图层/节点仍是严格 UUID。不接受名称或 step ID 冒充 UUID。

生产者输出来源是已成功执行的 Command 结果；createdObjectReferences 和 trace.objectBindings 保存同一实际绑定。创建失败不得产生绑定；两个创建结果不交叉绑定；未来输出仅暂时 DEFERRED，依赖先完成才解析。READ 的 live draft 与 bindings 保留。

规划及执行修参均使用 assertRepairTargets。只有错误分类是引用失效且 field 精确指向该引用时，允许改该字段；一般参数错误不得顺带换目标、嵌套节点或 ID 数组。每次候选仍执行原 scope、基线、schema 和真实 draft 校验。

工作记忆与诊断不进入 Scene；原工程在等待期间变化即停止，不覆盖人工修改。
