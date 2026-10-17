# Agent Execution Contract 0.10

唯一权威为 AgentToolRegistry 注册的 Zod schema。definitions、contract、动态 Fill 校验、模型声明均从同一 schema 生成；默认参数在正式解析时应用。contract 返回 permission、sideEffects、UUID 输出字段与引用规则。创建工具可省略对象 ID，输出必须取真实 Command 结果。

compileSemanticActions 接收已注册原生动作，在独立共享 CommandSystem 上预演，返回正式 Command[]；正式写入仍由既有 AgentTransaction 执行。createShape、placeAtCompositionCenter、setGradientFill、animateLayerProperty 是现有创建/属性/关键帧工具的组合编译，不是第二套执行器。center 读取当前合成尺寸；gradient 参数复用正式 ParameterDefinition；animation 通过属性名称解析实际 propertyId。

执行阶段保持 resolve → schema → scope/preflight → compile → Command → postflight。READ 不在预检中调用外部服务；后续 WRITE 对真实 draft 完整验证。verifyResults 按操作顺序归约最终态，不因多个合法 Keyframe Update 把中间状态当最终值。

工具选择仅压缩给模型的上下文，不增加权限。inspectToolContract 按需读取准确参数并扩展后续声明；调用不可用工具仍拒绝。高风险、循环、越界、基线冲突以及正式命令/结果失败不能以“修复”绕过。

animateLayerProperty.easing 复用 curve-model.easePresets（linear/hold/easeIn/easeOut/easeInOut），指定时覆盖每帧显式interpolation。贝塞尔out/in属于同一出段的两个归一化控制点；新增中点求值验收。discoverCapabilities搜索身份/名称/分类/关键词，不扫描参数schema内文而加载无关大契约；完整参数仍由实际匹配能力返回。规划剩余一次请求时强制完整submitPlan，避免最后预算继续只读。
