# SF 最小真实验收基线

**GO：本修复分支的指定2D编辑/保存/渲染基线允许作为P3前置基线。** 不代表Agent V2创建可靠性、MCP/AI2Comp、安全远程入口或全平台验收通过；V1默认及V2 CANARY NOT READY不变。本轮不自动开始P3开发。

真实运行对象为独立工作树 `/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance`，分支 `codex/minimal-real-acceptance`，从 `c755132` 创建。已阅读P0五份报告；原dirty工作区、原1.0.3工作树、P0报告及V2-7冻结报告保持不变。产品修改仅针对已发现的基础边界；无MCP、AI2Comp、Agent重构或第二Scene/Command/Renderer。

## 实际结果

| 运行 | 结果 | 范围 |
|---|---|---|
| 未修c755132真实Electron | 12通过、5失败 | 原生导入迟到、导入取消、晚到save路径、pending open期间GUI编辑、无法保存的候选；原始日志保留 |
| 首次局部修复 | 17/17通过 | 真实IO/Renderer检查；保存缓存回归随后由单元测试发现并修正 |
| 最终代码 final-a / final-b | 各17/17通过 | 两轮独立进程、工程UUID重新生成；6份Renderer PNG跨两轮哈希相同 |
| 两次第二进程重开 | 各1/1通过 | 原生读取保存文件，Scene/UUID/关键帧一致，Undo为空 |
| 完整现有测试 | 819/819通过 | `npm test -- --maxWorkers=1`，原超时/语义断言未改变；不计作真实模型成功 |
| 质量门禁 | typecheck/lint/desktop:build通过 | 标准desktop:build包含Web build；大chunk提示保留 |

见 [MINIMAL_RUN_SUMMARY.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/MINIMAL_RUN_SUMMARY.json)、[report.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/report.json)、[report.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-b/report.json)、[reopen-report.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/reopen-report.json) 和 [all-tests-final.json](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/all-tests-final.json)。

初次全量并行运行有一项5000ms超时，818通过/1失败。未提高超时或删除断言；该文件独立复跑9/9通过，100对象用例约3.26秒，随后单worker全量819通过。首次保存缓存回归18通过/1失败也保留在targeted-tests.json；最终原断言19/19通过。失败不是“忽略后整体PASS”。

## 可重复工程

[minimal-project.swayframe](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/evidence/final-a/minimal-project.swayframe)由真实`createDefaultProject/createComposition/createObject`及共享Commands创建：320×180，30fps，2秒；一个320×180蓝色solid背景、一个60×40红色矩形（opacity=0.5）、一个白色sans-serif文字“SF”（fontSize=32）；矩形位置0秒(80,90)、1秒(160,90)，linear。文字Scene原点(240,40)，默认文本框宽480且左对齐，因此字形出现在左侧；不把原点与字形边界混为一谈。

没有伪造缺失能力：本轮这些基础能力都实际存在。三维、媒体全格式、付费模型/自然语言创建以及Windows实机均**未验证**，不标记PASS。

## 编辑内核覆盖与真实路径

| 必测项 | 验证 |
|---|---|
| 创建 | `createObject`调用原`createLayer`，通过EditorStore.run→CommandSystem.executeTransaction生成solid/rectangle/text |
| 位置/尺寸/颜色 | 原valueCommand与layer.replace/patch；Scene真实值、ID、尺寸、editor fill等断言 |
| 关键帧 | 真实keyframe.add两条，0.5秒evaluateProperty.x=120 |
| Undo / Redo | 实际调用EditorStore.undo/redo，逐次比较完整规范化Scene，动画身份和内容恢复 |
| 保存 | ProjectService.save→实际preload/IPC→NativeServices→writeProject/atomicWrite；重读磁盘数据比对 |
| 关闭/重新打开 | ProjectService.closeProject使active=false、原Scene替换；open读取真实.swayframe、重新获取Scene |
| 第二进程 | 退出首进程再启动新的Electron，重新open同一文件，ID/三图层/两关键帧一致，正式历史为空 |
| 图片 | 真实8×8PNG、真实Chromium File/pathsForFiles、FileGrants/协议、createImageBitmap与黄色像素；Undo移除Scene引用 |

源码：[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/src/core/command-system.ts:636)、[src/ui/editor-store.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/src/ui/editor-store.ts:756)、[src/desktop/project-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/src/desktop/project-service.ts:10)、[apps/desktop/electron/files.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/apps/desktop/electron/files.ts:14)、[apps/desktop/electron/ipc.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/apps/desktop/electron/ipc.ts:7)、[src/desktop/asset-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/src/desktop/asset-service.ts:10)、[src/renderers/canvas2d.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/src/renderers/canvas2d.ts:38)。

QA只使用生产main/preload/IPC和App/EditorStore；专用桥仅授予/保存测试目录文件、采集证据和延后**实际IO返回值**。没有返回虚构API响应、替换FileGrants/文件系统、替换Bitmap或Canvas。文件选择是由Chromium DOM.setFileInputFiles设置真实File（不是手动对话框验收）。自动化直接调用真实产品动作/服务，并非每个GUI按钮的鼠标测试。

## A～E状态隔离

- A：选中原形状后改位置，再改尺寸；后续操作读取最新Scene，原ID保留。
- B：改色→Undo→再改尺寸；被放弃的Redo分支清空，撤销颜色保留。
- C：真实保存/关闭/重开后修改opacity，再Undo，ID保持。
- D：在**真实原生IO已完成、返回被暂停**时切换工程，随后释放导入/save返回；新Scene/历史/路径不被污染。另覆盖open等待期间GUI修改不会被覆盖。
- E：实际图片导入待返回时AbortController.abort，释放真实结果，Scene/历史不变。旧版导入没有AbortSignal支持，因此旧版不能标记“取消成功”；本轮为已有导入函数增加可选signal及提交前检查，没有新增GUI取消按钮。此用例不是Agent模型响应的端到端验证。

全部本轮必测项已自动化，无待完成的手动PASS项。异常路径包含预期拒绝信息，见 [SF_FAILURE_INJECTION_REPORT.md](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance/docs/qa/SF_FAILURE_INJECTION_REPORT.md)。

## 必要的局部修复

1. ProjectService文档generation和await后归属检查，阻止旧save的path回写及pending open覆盖GUI修改；同IDload也通过替换事务识别文档边界。
2. 导入、relink及既有素材添加图层使用捕获的Project和可选AbortSignal；多文件仅在自己的成功提交后推进捕获快照。共用既有Command/Transaction。
3. CommandSystem在发布Scene/历史前用既有saveProject校验真实可保存性；每实例保存一个当前序列化结果，EditorStore.save复用它。Undo/Redo更新同一结果，不创建第二数据源或放宽20MB限制。

## 运行命令

```bash
cd /Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/minimal-real-acceptance
node work/minimal-qa/run.mjs new-run-name
```

每次使用未占用的run名称；runner拒绝覆盖已有report。依赖沿用已安装node_modules，Electron必须能在当前桌面会话启动。runner先编译同一产品代码，然后顺序运行实际Electron及第二个重开进程。配置写入`work/minimal-qa/profiles/<run>`，测试工程/PNG/结果写入`docs/qa/evidence/<run>`。不得使用正式用户profile。

复现未修版本：`SF_QA_SOURCE=/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3 node work/minimal-qa/run.mjs baseline-new-name`；预期退出非0。原先直接运行保留在build-baseline.log / electron-baseline.log / evidence/baseline，不覆盖历史证据。

标准门禁：`npm run typecheck`、`npm run lint`、`npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/all-tests-final.json`、`npm run desktop:build`。现有部分单元测试会输出旧版本名的artifact副本；本轮已将新生成结果归档至unit-generated，并从c755132恢复自己新worktree中的历史副本，原冻结目录从未运行这些测试。见unit-output-provenance.json。

测试runner源码在work/minimal-qa（Git明确纳入源文件，编译文件及隔离profile不纳入），无多Agent、任务调度平台、长期测试服务或新产品Gateway。Electron QA的zip-worker import.meta/IIFE提示仅涉及未覆盖的zip打包，PNG通过单独保存采集，不声称该worker已通过。

## Go / No-Go边界

未修原版本为**NO-GO**。最终候选在本轮定义的基本路径为**GO**，允许后续P3任务以该修复分支为基线，不允许继续在原dirty目录假定已修复。P0的不可信路径授权/远程工具权限风险仍需相应功能单独准入；Agent真实创建未重新验收。禁止将本报告用作MCP、AI2Comp、Agent V2默认替换或Windows实机准入证明。

## 安装包候选

按此前持续交付要求，生成了同一修复源码的Mac arm64 DMG及Windows x64 NSIS。
版本号仍为1.0.3，属于独立最小修复候选，不覆盖原冻结安装包或宣称官方发布。
每端19个运行文件与本次dist/desktop-dist字节一致，关键package元数据一致；
QA桥/测试工程没有打入安装包。Mac DMG verify通过，Windows PE头通过。
两端未签名/未公证；Windows运行未验证。详见INSTALLER_MANIFEST.json。

首次安装包校验整文件比较package.json而误报，原因是builder裁剪开发元数据。
原校验记录保留package-integrity-initial.json；最终仍逐字节检查所有运行文件，
package只比较name/version/main/dependencies，不将元数据正常转换误判为产品差异。
