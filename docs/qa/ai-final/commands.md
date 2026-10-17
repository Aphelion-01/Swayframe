# 本轮实际运行命令与复跑边界

工作目录：`/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/ai-integration-final-acceptance`。Electron：旧工作区已安装的 `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`，不是新下载。每套独立 profile，禁止使用用户原工程。

```sh
npm run desktop:build
node work/final-native-qa/minimal-build.mjs
node work/final-cross-qa/build.mjs
node work/final-mcp-qa/build.mjs
node work/final-import-ui-qa/build.mjs
node work/final-separation-qa/build.mjs
SF_ELECTRON=/absolute/path/to/Electron node work/final-acceptance-runner.mjs
node work/final-import-qa/build.mjs
SF_QA_RUN=verified SWAYFRAME_USER_DATA=/private/tmp/sf-ai-final-import-verified "$SF_ELECTRON" work/final-import-qa/.compiled/desktop-dist/main.cjs
SF_QA_RUN=verified SWAYFRAME_USER_DATA=/private/tmp/sf-ai-final-import-reopen-verified "$SF_ELECTRON" work/final-import-qa/.compiled/desktop-dist/main.cjs --reopen-only
node work/final-agent-qa/build.mjs
SWAYFRAME_USER_DATA=/private/tmp/sf-ai-final-agent "$SF_ELECTRON" work/final-agent-qa/.compiled/desktop-dist/main.cjs
node work/agent-v2-7-1/replay.mjs . docs/qa/ai-final/replay-fixed.json
node work/agent-v2-7-1/replay.mjs ../1.0.3 docs/qa/ai-final/replay-frozen.json
npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/ai-final/all-tests.json
npm run lint
SF_EXTERNAL_OUT=docs/qa/ai-final/cross/run "$SF_PYTHON" work/final-cross-qa/compare.py
node work/final-package-integrity.cjs
hdiutil verify release/Swayframe-1.0.3-arm64.dmg
```

SF_PYTHON实际为附带PIL/numpy的Python；其他测试依赖为已有node_modules，不执行npm ci/install或付费API。Cross的空工程由原createComposition/createDefaultProject准备，包来自已冻结的外部真实生成样例；不是向运行中的Scene插入假层。复制及初始空工程准备过程见本轮source脚本和Git新增内容。

所有路径为本轮已占用证据，**不要直接重跑覆盖**。复跑先复制证据或新建独立worktree，将output/run/profile改成新路径，并从原生factory重建Cross空工程；使用保存完成的4层工程作为“初始空工程”会正确失败。不会自动清空正式工程来让测试过。

9个进程的顺序退出码见process-results.json；新增core/Agent/replay/全量命令分别有独立日志。早期core的current目录（19/20）和Agent QA编译失败日志保留，不替换为新PASS。

安装包按用户长期要求依次运行electron-builder --mac --arm64、--win --x64；使用同一已缓存electronDist。具体构建日志package-mac.log/package-win.log。版本仍1.0.3，unsigned诊断候选，不是统一AI正式发布。
