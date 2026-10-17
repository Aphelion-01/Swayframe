# SF Editor Operations 验证

**限定宿主内薄适配：GO。** 完整回归 **899/899通过**（原870 + 新29）；实际 Electron **17/17通过**。没有付费 API、外部网络、MCP服务或第二内核。

## 自动化结果与真实路径

| 覆盖 | 实际断言 |
|---|---|
| 四种查询 | 原不可变 Project/原选择投影；完整 Scene、Undo/Redo 不变；详情副本在客户端改名不污染正式层 |
| 显式修改 | 当前选中B却明确修改A，B不变；播放头不是请求 time；一项原 Transaction，可Undo/Redo、saveProject可读 |
| A 查询后删除 | 旧revision返回STALE_BASE；重新查询后原layerId返回INVALID_REFERENCE；其他层/历史不变 |
| B GUI改值 | 旧值请求不能覆盖最新GUI值；STALE_BASE |
| C 切工程/同ID重载 | 不同projectId返回CONTEXT_STALE；切回/同ID重开仍为旧revision，拒绝 |
| D 异步晚到导入 | 原native读包实际完成但延后返回，切新工程/删除目标合成后释放；新Scene/历史不污染 |
| E 同请求重交 | 原生Undo后即使刷新revision，同requestId仍REPLAY_FORBIDDEN；重复导入不取消首个任务 |
| 请求限制 | 256个ID不淘汰，达到上限明确BUDGET_EXCEEDED；新宿主nonce拒绝旧会话token |
| 原生校验 | opacity=2、把标量写到position、坏参数/路径/未知字段/锁定层均安全拒绝；未降低原Schema |
| 原生导入 | P3真实B包追加到明确非活动合成；顺序Background→Subject→Foreground、3素材、坐标/Alpha正确；保留活动合成/选区，单笔Undo/Redo精确恢复 |
| 导入错误/取消 | 实际损坏PNG、路径逃逸、未授权目录；取消/关闭适配宿主后放行真实返回，Scene/历史不变 |
| 与GUI导入并发 | GUI原importLayerPack正在读包，外部调用拒绝；原GUI任务仍能成功，Undo后原Scene恢复 |
| 保存/重开 | 原ProjectService→preload/IPC→atomicWrite；磁盘字节等于store.save，closeProject/open读回一致；旧revision拒绝、刷新查询后可继续编辑/Undo |
| 真实渲染 | 原OutputFrameRenderer/Canvas2DRenderer输出PNG；查询渲染不写Scene/历史；真实图层叠加像素检查，不只是“没有抛异常” |
| 渲染晚到/取消 | 延后原Renderer完成init的返回，GUI修改或abort后拒绝过期帧；dispose调用2/2，第二并发帧明确冲突 |
| 渲染失败 | 通过原Command放入语法可保存但真实PNG损坏的嵌入图，真实createImageBitmap失败→VERIFICATION_FAILURE/field=render；原Scene/历史保持，原Undo可移除注入图 |

真实Electron包装只授予自有测试包/输出路径、延后实际IO返回并采集结果；没有返回伪造PNG/metadata，未替换Scene/Command/Renderer。渲染竞态包装先执行原init再暂停，仍调用原draw/dispose。测试只为软件核验直接使用产品调用，并不宣称鼠标逐项GUI测试或外部MCP端到端成功。

另在真实 Electron 中动态导入正式 Vite 输出的 `dist/assets/editorOperations-*.js`，确认命名导出可用、查询正确，并对同一原生 Store 完成一次写入/Undo。没有用只在测试里存在的空壳入口代替交付模块。

## Renderer像素证据

`docs/qa/editor-operations/real/layerpack-frame.png` 为实际输出，64×48、sRGB、8-bit RGBA读回，透明背景。检查：

- (0,0) = [0,0,0,0]，画布透明区域。
- (4,4) = [0,0,255,255]，底层蓝色及裁切定位。
- (10,10) ≈ [128,0,127,255]，半透明红色叠加蓝色。
- (24,20) ≈ [64,128,63,255]，前景绿色/红色/蓝色叠放顺序。

每通道容差≤2沿用P1/P3的8-bit Alpha与Canvas source-over取整边界，没有按实际差异放宽。未宣称线性光/HDR/全格式媒体验证。详见 `real/pixels.json`。

## 运行与产物

```bash
cd /Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/editor-operations-v0
npm run typecheck
npm run lint
npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/editor-operations/all-tests.json
npm run desktop:build
node work/editor-operations-qa/build.mjs
SWAYFRAME_USER_DATA=/private/tmp/sf-editor-operations-qa-final ./node_modules/.bin/electron work/editor-operations-qa/.compiled/desktop-dist/main.cjs
```

固定QA路径会覆盖本分支上次运行产物；复跑前另存或调整脚本输出目录，不能覆盖历史冻结报告或使用正式用户profile。

证据目录 `docs/qa/editor-operations/`：all-tests.json/log、targeted.json/log、lint.log、build.log、electron-final.log、real/report.json、real/records.json、real/errors.json、real/scene.json、real/operations.swayframe、real/layerpack-frame.png。

最初真实运行11通过/1失败：测试把Undo后Redo数也要求与提交前完全一致，而原生Undo正确增加一项Redo；保留 `initial/report.json` / `initial/electron.log`。仅修正本轮新测试的错误历史断言，改为完整Scene恢复+Undo恢复+Redo为1，未修改产品Undo或旧语义断言。最终17项全部通过。

完整测试会更新少量历史版本名的生成副本；新生成文件另存 `unit-generated`，本新worktree对应历史文件恢复至263a47c。原工作区/P0/P1/P3/P4与冻结V2-7证据不改，见unit-output-provenance.json/source-protection.json。

## 构建及范围

实际正式 dist/index.html + 原生产main/preload的独立Electron启动页检查通过（app-startup.json），contextIsolation=true、nodeIntegration=false、sandbox=true；只证明本机启动，不冒充Windows验收。

标准 typecheck、lint、desktop:build 通过，Vite editorOperations 模块约7.42kB（gzip3.03kB），复用既有依赖chunk；大chunk提示保留。未另建包注册中心、动态插件或协议。

Mac arm64与Win x64候选安装包按用户约定生成，仍用1.0.3版本的独立候选目录。包内运行文件与最终dist/desktop-dist逐字节比较；Mac DMG校验/Win PE头检查见package-integrity.json、installers.json、dmg-verify.log。QA桥不打包。未签名/未公证；Windows实机与新增传输端都未验证，不标记PASS。

V1继续默认，V2历史Canary结论不变。此GO仅允许后续具体任务在可信宿主上使用上述有限调用契约，不允许借此新增任意远程命令执行服务。
