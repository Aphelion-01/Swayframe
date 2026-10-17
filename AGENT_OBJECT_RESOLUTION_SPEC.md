# Agent Object Resolution Spec — 0.9.28

## 契约及唯一入口

复用现有 AgentToolRegistry。现有合法 UUID 调用继续有效。UUID 输入也可接受严格的 AgentObjectRef：

```ts
{ kind: 'existing', id: actualUuid }
{ kind: 'selection', objectType: 'layer' }
{ kind: 'stepResult', stepId: 'create_background', output: 'layerId' }
{ kind: 'graphNode', nodeId: actualNodeUuid }
```

字段仍称 `layerId/nodeId/...`，模型契约在这些字段上声明 UUID 或引用对象；无需第二套工具，也无需改原 Command API。嵌套 `connectNodes.from.nodeId/to.nodeId`、数组 ID 及可空父级引用同样接入。创建工具的可选输出 ID 保持原 UUID schema；建议省略，由核心生成。

## 解析顺序

1. 结构校验和权限检查。
2. Step 引用必须指向此前已完成步骤；不得前向引用、循环引用或重复步骤 ID。
3. Existing/GraphNode 查询真实 Scene 中的对应实体；Selection 必须恰好一个对象；StepResult 查询当前事务实际结果表。
4. 验证原生 UUID、实体存在、对象类型、所在合成，然后保留既有能力/参数/锁定/范围校验。
5. 使用真实 ID 编译共享 Command；事务最终仍只有一次 commit。

预检中结构校验用一个合法占位 ID检查其余参数，绝不提交该占位值或创建伪对象。确定操作在独立共享 CommandSystem 中预演，以实际预演产物检查后续语义；有 StepResult 的步骤仍标记 `DEFERRED`，正式执行必须从实际运行的创建结果重新解析。Forge 和异步 READ 保持已有延期边界，不用模拟外部产物跳过实际执行校验。

## 实际结果表及恢复

每个 AgentTransaction 私有 `StepResultMap`。创建成功后返回明确的 `layerId/nodeId/...` 和 `outputs`，只绑定实际新增且唯一的实体。创建多个属性时不随意挑选 propertyId；使用真实 Layer Ref 加属性路径的 addKeyframe。节点创建只绑定请求类型的新节点，避免误用自动出现的 Source 或 Output。

成功步骤不允许重复执行。模型纠错只能替换未完成步骤的参数；恢复反馈包含已完成 Step 的真实结果，语义引用先按当前 Draft 解析，再进行单步预检。失败指纹按稳定参数编码去重，保留原有全局执行纠错预算 2。无法恢复或相同错误重复时停止，不重复创建、添加效果或提交部分 Scene。

更换/重建 Draft 清空绑定，重新从新执行结果绑定。Map 是运行时身份映射，不是另一套 Scene。用户执行期间修改正式工程，仍由原基线引用检查阻止 commit。既有 Scope Protection 在每次草稿修改和最终提交检查，失败关闭事务。

## 诊断分类

| reason | 对外 code | 含义 |
| --- | --- | --- |
| INVALID_UUID_FORMAT | INVALID_OBJECT_ID | 名称、步骤字面值等不合法 ID |
| VALID_UUID_BUT_NOT_FOUND | TARGET_NOT_FOUND | 格式正确但 Scene 中不存在 |
| WRONG_OBJECT_TYPE | CONTEXT_INVALID | Layer/Node/Property 等类型混用 |
| WRONG_COMPOSITION | CONTEXT_INVALID | 对象属于其他合成 |
| STALE_OBJECT_REFERENCE | CONTEXT_INVALID | 已绑定对象被删除，或企图重放成功步骤 |
| UNRESOLVED_STEP_REFERENCE | CONTEXT_INVALID | 前置步骤未完成、产物不唯一或引用不存在 |
| MISSING_TARGET | CONTEXT_INVALID | 无目标或空 Selection |
| AMBIGUOUS_TARGET | CONTEXT_INVALID | 多选且未明确目标，返回候选 ID |
| OUT_OF_SCOPE_TARGET | CONTEXT_INVALID | 既有范围保护拒绝修改 |

日志关联 sessionId、plan/task/step、tool、phase、errorId、原参数、已解析参数、Selection、合成、真实 Layer index、结果及恢复。脱敏去掉凭据与图像数据并限制大小；超预算明确记录省略，不截断 JSON。只有启用既有“保存历史”设置才持久化；不绕过隐私设置。

Assistant 是唯一现有用户入口；本轮没有新按钮、菜单或第二套 Scene 注册。Feature 的主归属和九域没有变化。
