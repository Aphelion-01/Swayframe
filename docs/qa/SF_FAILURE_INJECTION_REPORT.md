# SF 失败注入与隔离报告

**最终两轮拒绝/隔离断言全部通过；原版5项真实失败已保留。** 不把预期拒绝或缺陷复现混同为业务成功。

## 注入项

| 注入 | 实际路径与保护断言 |
|---|---|
| 无效layerId | 正确UUID但Scene中不存在→layer.patch失败；完整Scene、Undo/Redo不变，loadProject(store.save)成功 |
| 已删除图层 | 实际创建/删除临时ellipse，再patch原ID→失败；真实删除状态不被复活，历史不增加 |
| 错误属性 | opacity写入Vec2，实际projectSchema拒绝；不降低原类型语义校验 |
| 事务中途失败 | 同一transaction先create有效ellipse，再对不存在propertyId setBase；整个Scene/历史保持原状态 |
| 素材文件不存在 | preload.assets.importFiles→installIPC→NativeAssets.import→实际fs.open失败；未创建Asset/Layer/错误引用，工程仍可保存 |
| 无法保存的候选 | 两个11MB语法有效base64 Asset，真实序列化超过20MB；提交前拒绝，Scene/历史不变。该数据仅测试总大小，不冒充可解码图片 |

每条命令失败检查完整规范化Scene、Undo/Redo长度、工程序列化/重载；缺文件检查实际拒绝及Scene/历史/Asset为空，原始before/after记录亦保留Redo长度。失败日志为实际返回错误，非手工编造：

| ID | 实际错误 |
|---|---|
| F-invalid-layerId | 图层不存在 |
| F-deleted-layer | 图层不存在 |
| F-wrong-property | [   {     "expected": "number",     "code": "invalid_type",     "path": [       "compositions",       0,       "layers",       1,       "transform",       "opacity",       "baseValue"     ],     "message": "Invalid input: expected number, received object"   } ] |
| F-mid-transaction | 属性不存在 |
| F-missing-file | Error: 原生操作未完成，请检查文件权限或日志后重试。 |
| F-unsaveable-candidate | 工程文件超过 20 MB |

见 [failure-log.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/failure-log.json)、[records.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/records.json)、[report.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-b/report.json)。

## 真实IO竞态复现与修复

QA在NativeServices.dispatch执行原IO后，仅推迟真实结果向renderer返回；测试显式检查gate.ready再进行切换/取消，随后release。因此可重复控制顺序，同时文件确实被读取/写入/解码，没有Mock API或伪造输出。

未修c755132实测5项失败：导入返回污染新工程；旧版没有导入signal取消支持，abort后结果仍提交；旧save path回写到newProject；等待open期间GUI修改丢失；大Asset候选提交后不能保存。原报告 [report.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/baseline/report.json)、[electron-baseline.log](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/electron-baseline.log) 保持原始FAIL。

最终final-a/final-b同一集合全部通过。newProject后Scene/空历史/path=null保持，取消后结果不增加任何Scene引用，pending open保留已提交GUI修改和dirty状态。当前修复只覆盖现有操作边界；不宣称Agent语义创建已恢复，也没有原生批量素材“整批原子”或物理GC能力。

## 开发失败日志保留

- targeted-tests.json：新增提交可保存性检查时触发保存重复序列化断言，18通过/1失败；未改断言，改为复用CommandSystem当前序列化结果后原19项通过。
- all-tests.json：并行全量818通过/1超时；boundary-isolated-tests.json原100对象测试在约3.26秒完成，单worker all-tests-final.json全819通过。原5000ms和语义断言不变。
- OS task_policy_set日志为Electron结束时的非致命macOS提示；不是省略启动失败，完整repeat-final-b.log及第二进程report均保留。

## 自动化边界

A～E和本轮全部必测失败注入已由真实Electron自动化，因此没有需要以截图补成手动PASS的条目。PNG是实际Renderer产物。文件对话框的人为点选、Windows实机、3D/全部媒体与真实模型响应未测，明确不标记自动化PASS；当前Go只覆盖指定最小2D核心。
