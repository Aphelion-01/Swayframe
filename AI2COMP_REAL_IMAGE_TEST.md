# AI2Comp V0.1 — 真实照片测试

结论：三类真实照片均通过公共本地模型生成实际透明PNG，并通过原P3/P4导入真实Electron；限定路径 E2E PASS。没有付费API，网络请求监测为0。系统选择器自动选择受控fixture，不声称人工鼠标验收。

| 样例 | 尺寸 | 实际结果与保留缺陷 |
|---|---|---|
| A chelsea（猫） | 451×300 | 主体与背景主边界分开；细胡须有漏分，非精细毛发抠图 |
| B astronaut（人物） | 512×512 | 人物/装备主体合并，软边存在；飞发细节不完整，不保证头发物理透明度 |
| C coffee（遮挡） | 600×400 | 杯、盘、勺合并主体；木纹背景被遮挡部分留透明洞，不猜测恢复 |

源照片许可和固定下载地址见 `docs/qa/segmentation/inputs/ATTRIBUTION.md`，SHA256见 `input-hashes.json`。没有用预制透明素材替代模型结果。

## 实际编辑与像素断言

`docs/qa/segmentation/final-repeat/report.json`：17/17。每张：菜单触发→真实分割→P4预览（确认前Scene不变）→确认产生原生合成→Undo/Redo导入；两层分别移动、调整透明度、添加关键帧；原`OutputFrameRenderer`输出变化帧；保存、关闭、重开、再次编辑。还覆盖取消选图、真实结果晚到取消、切工程晚到拒绝、staging ENOSPC回滚、损坏PNG。

每图 `*-pixels.json`：原生Renderer与reference逐通道比较，容差2（RGBA8量化/浏览器Canvas sRGB舍入允许≤2）；本轮实际最大差0、超限通道0。移动/透明度/关键帧检查实际画面变化及其他层状态保持，不只检查render不抛异常。全部渲染PNG保存在同目录。重合一致不等于分割准确。

`docs/qa/segmentation/production/report.json`：4/4。正式dist页面及未改production preload，使用Mac包内helper，真实菜单、限制说明、原生层面板、Cmd+S落盘合成和内嵌图片均通过。该测试不是整个安装App启动验收；Windows尚无运行证据。

## 可重复命令

在本独立worktree执行；`SF_ELECTRON`指向本机已安装Electron可执行文件，运行需要正常本机Vision权限。采用新输出目录，不覆盖冻结证据。

```sh
npm run desktop:build
node work/image-layers-qa/generate.mjs
node work/image-layers-qa/build.mjs
SF_IMAGE_QA_OUT=docs/qa/segmentation/new-repeat SWAYFRAME_USER_DATA=/private/tmp/sf-image-layers-new "$SF_ELECTRON" work/image-layers-qa/.compiled/desktop-dist/main.cjs
npm test -- --maxWorkers=2 --reporter=json --outputFile=docs/qa/segmentation/new-tests.json
```

`generate.mjs`生成新的唯一输出目录但会更新generation索引；先保留旧索引。诊断：附带Python执行 `work/image-layers-qa/alpha-analysis.py`，其结果不是替代产品Renderer。正式界面复验见 `build-production.mjs` / `production.ts`，传入测试工程副本路径（不能传用户原工程）。

## 未隐藏的失败

`final/`一次收尾未完成，不能标17项PASS。QA补充等待弹窗卸载后，完整`final-repeat/`通过；没有改产品语义让测试绕过。`corrupt-only/`独立通过。`all-tests-final.json`的既有Agent测试5000ms超时保留，`boundary-repeat.json`9项通过；初轮全量908通过。最终受控并发复验 `all-tests-confirmed.json`：908/908通过。

窗口退出时发现继承的`window.webContents` getter在已销毁窗口上抛错。`mcp-bridge.ts::installMCPBridge`只改为保存contents引用后检查isDestroyed，不改协议/权限/工具；`mcp-exit-regression/window-close/report.json`5项通过，进程code0、listener释放、工程不变。
