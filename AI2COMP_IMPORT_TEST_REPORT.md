# AI2Comp V0 验收

**限定输入规范内的 Layer Package Import Core：GO。** 无AI生成、自动分割、MCP或复杂模板；付费API调用0。V1默认/V2 Canary状态不因本功能改变。

基线 `8479ec3`，独立 `codex/ai2comp-layerpack-v0`。P0审计/P1基线已阅读；继承P1的工程归属和可保存性修复，不重写历史报告。

## 运行方式

```sh
node work/ai2comp-qa/fixtures.mjs
npx vitest run tests/layerpack.test.ts tests/feature-registry.test.ts tests/desktop-contract.test.ts --maxWorkers=1
npm test -- --maxWorkers=1
npm run typecheck
npm run lint
npm run desktop:build
node work/ai2comp-qa/run.mjs fresh-unique-run
```

实际工具日志在 `docs/qa/ai2comp/`。依赖沿用本地安装，不需要网络或密钥。Electron runner真实加载生产main/preload/IPC、NativeServices、EditorStore/App、ProjectService与Renderer。QA桥只授予自己生成的测试目录、记录证据及暂停真实IO返回值；不伪造文件内容/Scene/Command/Renderer成功。原生系统文件选择的人工点选未自动化，使用直接传入已批准测试目录验证实际导入核心。

## 结果

- 完整回归：**865/865 PASS，168文件**，原838 + 新27。单worker，未更改超时或已有语义断言。
- 定向：27个包格式/路径/资源单元测试，加既有3个Feature Placement和2个Desktop Contract检查，共32 PASS。单元nativeImage明确stub，仅用于路径/格式检查；真实解码在Electron中验收，不冒称单元测试端到端。
- typecheck、lint、desktop build PASS。大chunk提示及QA IIFE中未覆盖zip.worker的import.meta提示保留，未以此宣称ZIP导出通过。
- final-c / final-d / final-e 各17项真实核心检查 PASS，加各1项新进程重开PASS，networkAttempts/modelAttempts均0；final-i扩展集合20/20及新进程1/1通过，补充opacity及已有合成路径。

### 真实覆盖

| 必须验证项 | 真实证据 |
|---|---|
| A三个完整透明PNG、B三个裁切PNG | 各产生正确3个原生image Layer，名称/顺序/尺寸/中心位置正确；A/B成片逐通道相同 |
| C坏路径/损坏PNG | 均拒绝，Scene/Undo/Redo不变，仍可保存；损坏第二图时无第一图残留 |
| 每层移动、透明度、关键帧 | 三层分别运行原valueCommand/keyframe.add并检查非目标层不变；opacity及动画实际Renderer PNG变化 |
| Undo / Redo | 整个导入一项正式Transaction，完整序列化Scene、ID、资产恢复 |
| 资产重复/共享 | 相同包再导入新增Asset=0；Undo保留首个合成共享引用；Redo不产生重复素材 |
| 保存、关闭、重开、第二进程 | 真实atomicWrite/readProject/hydrate/loadProject，删除测试源包后仍能恢复并渲染 |
| 引用图 | 参考图存在而Assets恰好3个，不成为图层或资源 |
| 取消/晚到 | 暂停实际Native读取结果，取消后释放，Scene/历史不变 |
| 切换工程/删除目标合成 | 正式Project操作后释放旧结果，保留新Scene/历史，不自动合并 |
| 第二次导入 | 旧任务取消，最新任务唯一提交，不生成半合成 |
| 事务中途失败 | 在完整导入末尾注入实际无效layer.delete，原事务全量拒绝 |
| 合并后20MB限制 | 使用真实可解码的随机PNG构造候选超限，正式Scene/历史不变且原工程仍可保存 |
| typed UI入口 | menu.file注册唯一命令，PROJECT/F4，无永久按钮；真实DOM入口、取消禁用、菜单宽度边界检查与截图 |

## 首轮失败记录

- electron-first：受限环境Electron进程未启动，不能记为功能PASS；随后隔离真实桌面启动通过。
- first-real：已通过前三项，但脚本没有指定测试保存路径而停在系统保存对话框，超时停止。改用原ProjectService.recover绑定测试路径，未模拟save成功。
- second-real：QA误认为closeProject返回boolean（实际void）；真实关闭已执行，该断言失败。修正QA为检查service.active，再完整复跑。
- final-a/b：QA编译/样例生成器错误（CJS top-level await、局部变量遮蔽），日志保留；未修改产品验证降低标准。
- final-f：隐藏窗口的截图等待超时，18项核心/隔离检查已通过但没有完整PASS报告；在QA中使用Electron capturePage的stayHidden/stayAwake选项后final-g/h完整通过。第二进程使用独立records/frames文件名，避免覆盖首进程证据。
- lint-initial：测试文件显式any被规则拒绝；改用明确FixtureManifest类型，最终lint通过。

## 边界

只支持manifest v1规定的8-bit RGBA sRGB PNG和容量。不是任意PNG/ICC/大包导入器。未测试Windows实机、磁盘满、恶意并发文件系统攻击的全部时序；无模型成功率声明。取消与新请求检查通过不代表任意外部工具调用已获授权。

按照持续交付要求生成Mac arm64 DMG / Windows x64 NSIS，metadata仍为基线1.0.3，属于此独立功能候选；包内运行文件与本构建一致，Mac DMG verify、Windows PE检查和SHA见installers.json/package-integrity.json。两端未签名、Mac未公证、Windows未实机验收。

其他交付：AI2COMP_MANIFEST_V1.md、AI2COMP_IMPORT_ARCHITECTURE.md、AI2COMP_RENDER_COMPARISON.md、AI2COMP_ASSET_ROLLBACK_REPORT.md。可靠资产持久化与回滚已在限定策略下验证，不扩展外部托管文件/AI/MCP。
