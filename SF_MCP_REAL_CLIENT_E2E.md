# SF MCP 真实客户端验收

**GO：七工具、主动授权、限定本机的 MCP Bridge V0。默认关闭。** 原生 Scene 编辑、导入、渲染和真实 GUI 已有跨进程证据；不等于 Windows 实机/所有 Host/远程服务通过。

## 实际运行结果

- 官方 Client/Server SDK 2.3.1；最终 pin 2026-07-28，wireVersions 同时记录 modern 与 2026-07-28。
- docs/qa/mcp/final-e/report.json：14/14；零网络/模型调用。
- docs/qa/mcp/production/report.json：8/8；加载正式 dist/index.html 和原生 preload，使用实际 src/main.tsx 创建的 Store/ProjectService，非 QA 另建 Store。
- 903/903 现有与新增回归，typecheck / lint / desktop:build 通过。单元的 schema 映射测试与真实跨进程 E2E 分开计数，不用 Mock 声称端到端。
- docs/qa/mcp/packaged-cli/report.json 验证 Mac asar 内 CLI 及应用自带运行时；安装包完整性另见 installers.json。

## 必测操作与证据

| 操作 | 真实验证 |
|---|---|
| 连接运行中的 SF / 七工具发现 | 官方 Client 启动独立 stdio 子进程；子进程通过鉴权 TCP 和真实 Electron IPC 连接当前 Renderer |
| Scene Tree / inspect / selection | 对实际工程 UUID、层名、原生属性、选择及图层数量断言 |
| 修改位置 / GUI 可见 | MCP 设置明确 layerId/property/time/value；正式 dist 中 Inspector 查询值改变，真实 Renderer before.png/after.png 不同，actual-dist-gui.png 显示结果 |
| Undo / Redo | final-e 完整序列化 Scene 与原生历史比对；production 使用 GUI 的 Meta+Z/Shift+Meta+Z，再通过外部查询验证 |
| 真实 Layer Package | P3 B 包三张裁切 PNG，经原生文件访问授权、严格读取、解码、内嵌资产、原 Transaction 导入；立即 Undo/Redo 比对整个 Scene |
| 渲染一帧 | sf_render_frame 返回 MCP image/png block；64×48 实际 PNG，透明/叠色/裁切位置像素断言，不只是无异常 |
| 保存/重开 | 原 ProjectService/IPC/atomicWrite；production 使用 GUI 保存，重读实际文件，关闭工程/重新打开后再连接并检查修改保留 |
| 关闭连接 | Client.close 结束 stdio；编辑器收 socket close、取消未提交操作。原 token 不能再次读取工程；用户关闭授权显示已关闭 |

像素：final-e/mcp-frame.png，(0,0)=[0,0,0,0]，(4,4)=[0,0,255,255]，(10,10)≈[128,0,127,255]，(24,20)≈[64,128,63,255]；容差每通道2来自原 P3 sRGB Canvas 8-bit Alpha 舍入，没有调整 Renderer。

production 的正式页面无 QA Renderer bridge；仅主进程测试脚本触发原 UI 控件、键盘及原菜单 action，读取 DOM/截图。外部协议仍由官方 Client 调用独立服务器。没有给 MCP 加 eval/GUI 调试工具，也没有通过开发脚本伪造导入或写入成功。

final-e 的扩大失败注入页面使用同一生产 App/Store/ProjectService/host 和真实原生 main/preload/Reader/Renderer；测试专用 IPC 只控制自有工程、采集结果和延后真实 IO 返回。原生文件夹对话框自动选择自有测试包、未保存提示自动选择“不保存”，不是人工逐次点选或对话框视觉验收。真实生产验收另通过 DOM 点击 MCP 权限/启用/关闭。必须区分这些自动化边界。

## 运行命令

```sh
npm ci
npm run desktop:build
node work/mcp-qa/build.mjs
SF_MCP_QA_OUT=docs/qa/mcp/new-run SWAYFRAME_USER_DATA=/private/tmp/sf-mcp-new-run /absolute/path/to/Electron work/mcp-qa/.compiled/desktop-dist/main.cjs
node work/mcp-qa/build-production.mjs
# 使用自有 .swayframe 副本作为最后参数，禁止私人正式工程。
SF_MCP_PROD_OUT=docs/qa/mcp/new-production SWAYFRAME_USER_DATA=/private/tmp/sf-mcp-new-production /absolute/path/to/Electron work/mcp-qa/.compiled/desktop-dist/production.cjs /private/tmp/owned.swayframe
```

Mac 本轮实际 Electron 来自原工作区已安装的44.5.1；路径保存在构建/日志说明中。运行需可用的已解锁桌面。输出目录请使用新的名称，不覆盖最终证据。production 输入文件可复制 final-e/mcp.swayframe；需要64×48四层样例。Electron QA 代码在 work/mcp-qa，以指定源码纳入 Git；编译物、配置密钥和用户 profile 不纳入。

标准检查：`npm run typecheck`，`npm run lint`，`npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/mcp/all-tests-final.json`。历史测试生成文件的新结果已复制到 unit-generated，再在本 worktree 恢复起点版本；冻结目录未运行或改写。

## 真实失败记录

1. first：11/12，透明角落像素错误。原测试矩形默认240px覆盖整个64px画布；将测试物体明确为8×8后通过，原失败PNG/report保留。不是降低容差或修 Renderer。
2. second-incomplete：隐藏窗口截图阻塞，只有部分 records，180秒退出；不得视为 PASS。
3. final-a：12/14，两个截图超时。明确给截图8秒上限后保留失败，不拖住其他检查；此时核心像素/异常检查已通过，但整轮仍 FAIL。
4. final-e：让隔离验收窗口可见，截图及14项全部通过。现代客户端显式 pin；此前 legacy 试跑不能冒充现代 wire 验证。

无付费 AI API，无真实模型成功率、Agent Canary 或默认切换结论。原 V1 默认与 V2 的独立准入状态不变。

## 退出边界补充

window-close/report.json：独立 Node 客户端连接实际 Electron，在原生导入真实返回暂停时销毁窗口；Electron以0退出、客户端收到 Connection closed、监听释放、已保存文件不变。客户端不在被关闭的应用进程中，5项检查通过。

final-c/final-d 两次试跑的14项均完成，但退出观察客户端也位于被测 Electron 主进程，窗口关闭后无法完成自身收尾，未产生完整 PASS。保留 partial records/log，不将它们视为产品事务失败或新增 PASS；由独立 Node 父进程重做上述检查。退出路径补充了对已销毁 webContents 的发送保护。原 V2-7 冻结报告不改。

最终源码复跑：final-e 14/14；final-production 8/8（正式dist + 最终Mac包内CLI）；window-close 独立Node进程5项检查通过；all-tests-final 903/903。两端各25个运行文件与最终构建逐字节一致，QA未打入包；DMG校验及Windows PE检查通过。两端未签名，Mac未公证，Windows运行未验证。
