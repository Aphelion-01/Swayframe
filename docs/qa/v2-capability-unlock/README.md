# V2 Capability Unlock evidence

源码冻结见 environment.json、source-files-sha256.json；本目录新证据不覆盖历史报告。

- unit.json：首次全量918/919，高并发一个100动作测试超时；unit-frozen.json：最终922/922。
- electron/report.json：最终真实Electron、受控Provider动作、正式Scene、原生Undo/Redo/Serialization、实际Renderer；16组含T1–T10及6次配对。fixture请求不能当模型调用。
- electron/*.png：实际UI截图与原Renderer输出；UI-尺寸图用Electron CDP实际CSS视口，最后一轮检查innerWidth/innerHeight，缩放1。
- electron-before-viewport-correction.json：保留此前同任务成功、但窗口高度被系统限制的运行，不冒充四种尺寸全部已覆盖。
- frozen-response-replay.json：原call29/30错误输出的离线Replay，正式Scene不变；不是新Live。
- legacy-test-output-regenerated：原有测试自动重写的随机ID/性能证据副本；旧路径已按HEAD原样恢复，没有清理用户修改。
- package-integrity.json / helper-integrity.json / installers.json / dmg-verify.log：候选安装包完整性与哈希；不是签名或Windows运行证据。

## 重复命令

```sh
npm run typecheck
npm run lint
npm test -- --maxWorkers=2 --reporter=json --outputFile=docs/qa/v2-capability-unlock/unit-frozen.json
npm run desktop:build
node work/capability-unlock-qa/build.mjs
SWAYFRAME_USER_DATA=/private/tmp/sf-v2-unlock-independent /absolute/path/to/Electron.app/Contents/MacOS/Electron work/capability-unlock-qa/.compiled/desktop-dist/main.cjs
node work/agent-v2-7-1/replay.mjs . docs/qa/v2-capability-unlock/frozen-response-replay.json
node work/capability-unlock-qa/package-integrity.cjs
```

Node依赖使用既有同版本node_modules；不在共享依赖目录安装包。Electron测试必须用独立userData，原生AI IPC与HTTP被测试进程阻断，不读取真实密钥。重复执行旧测试会生成旧outputs路径文件，须只恢复这类本轮生成产物，不能清理其他工作区修改。

四种视口截图最终明确激活助手页，并检查V2面板可见；electron-before-assistant-viewport.json保留此前视口正确但误选图层页的运行。
