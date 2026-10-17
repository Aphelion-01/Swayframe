# SF AI-to-Composition — Real E2E

**PASS：带 GUI 协助的通用外部 Agent 工作流。** 实际完成外部素材→标准 Layer Package→当前真实 SF 工程→独立图层编辑→原生关键帧→两帧渲染→保存重开。GPT Work / 纯MCP首次建动画 / Windows不在PASS范围。

## 证据和进程拓扑

`docs/qa/external-ai/final-run/report.json`：25/25；首轮 `run/report.json`同样25/25。`client.json`记录不同的客户端/编辑器PID、实际SDK 2.3.1、发现的工具；`tool-calls.json`保存真实参数、text返回、image返回大小/哈希。PNG实际bytes分别落盘，不只检查函数未抛异常。

独立 Node Parent（Client）→ 独立 stdio MCP Server → 256-bit临时授权的127.0.0.1桥 → 正式 Electron IPC → `src/mcp/renderer-host.ts::attachMCPHost` → 原 Store 的 `EditorOperations`。Electron加载实际`dist/index.html`与未追加QA入口的production preload，由实际`src/main.tsx`建立Store。GUI驱动只执行固定测试动作，不提供外部eval工具，不维护另一份Scene。

测试初始空工程由原`createComposition` / `createDefaultProject` / `saveProject`准备，载入后所有图层通过MCP原Importer导入。没有从脚本往运行中的Scene塞临时图层。原生PNG Reader在事务前执行严格校验；manifest顺序和bounds经实际Renderer对照。

## 本轮真实调用计数

| 工具 | 次数 |
|---|---:|
| sf_project_info | 28 |
| sf_scene_tree | 4 |
| sf_import_layer_package | 1 |
| sf_inspect_layer | 12 |
| sf_set_property | 7 |
| sf_render_frame | 5 |

共57次；另有SDK连接与listTools。7次写属性包括主体移动、标题透明度修改/恢复、背景透明度修改/恢复、第二关键帧和一次故意无效ID请求。sf_selection仅被发现，未调用。

## 关键检查

- 导入四个原生 image layer，bottom-to-top：Background / Circuit accents / Main Subject / Title — ORBIT SYSTEMS (Raster)。P3包内id不冒充原生UUID。
- `scene-after-import.json`是真实查询返回；主体移动不修改标题和背景对象，后两者各自透明度可独立改动并恢复。
- `GUI-inspector.json`：选中真实主体UUID，位置X=`710`；`moved-editor.png`保留Inspector与画面实际变化。
- GUI开启位置动画后读取关键帧数1；MCP写time=1后读取2，最终`animated-layer.json`保留原生关键帧。不是把两张不同PNG伪装为动画。
- `animation-0.png` / `animation-1.png`来自实际`sf_render_frame`的image/png block；`visual-report.json`有独立逐像素断言。
- GUI Undo导入回到0层，Redo恢复4层。GUI Cmd+S写出的`workflow.swayframe`含4个内嵌素材和2个原生位置关键帧。
- 关闭重开后重新授权客户端，主体结构/关键帧不变，重渲染t=1与预期一致。最终用户等价关闭授权，`electron.json`为disabled=true。

## 失败、警告与人工协助

一次故意请求随机layerId，实际返回`INVALID_REFERENCE`、MCP isError=true；主体序列化结构保持不变，保存重开后最终画面仍通过对照。记录在tool-calls.json及tool-summary.json，不将这次拒绝计为成功写入。

两个完整E2E运行无意外失败。Electron日志保留一条`sandbox_extension_issue_file ... Operation not permitted`资源警告；本次本地Vision、原生图像导入和渲染成功，不隐藏警告，也不解释为所有沙箱场景通过。

需要真实权限/目录选择、首次开启动画、保存/重开等GUI步骤，本次由固定UI驱动自动执行。系统文件夹对话框使用受控fixture返回；没有人工用户研究或人工逐次点选证据。MCP本身不提供首次建动画或保存工程，不声称这些全部由MCP调用完成。

未新增付费模型请求；测试没有触发AI聊天/生图，Renderer会话HTTP请求计数0（本机MCP TCP不计入该HTTP计数；不作为整个OS网络审计）。P7为本机系统模型推理，不外发照片。

## 重复执行

在独立worktree，安装依赖沿用已有锁文件。SF_ELECTRON指本机可运行Electron，SF_PYTHON指有PIL/numpy的Python；输出与profile选择新路径。

```sh
npm run desktop:build
node work/external-ai-qa/prepare.mjs
"$SF_PYTHON" work/external-ai-qa/design.py
node work/external-ai-qa/build.mjs
SF_EXTERNAL_OUT=docs/qa/external-ai/new-run SWAYFRAME_USER_DATA=/private/tmp/sf-external-new node work/external-ai-qa/client.mjs
SF_EXTERNAL_OUT=docs/qa/external-ai/new-run "$SF_PYTHON" work/external-ai-qa/compare.py
```

prepare会重置自有workflow.swayframe并重新调用P7，重新运行前保存此前工程副本；不会触碰用户工程。当前机器Electron44.5.1来自旧工作区已安装副本；helper在正常本机权限下运行。脚本不安装配置到Codex/ChatGPT，不保存令牌。

定向回归：`npm test -- tests/mcp-bridge.test.ts tests/layerpack.test.ts tests/layerpack-confirmation.test.ts tests/editor-operations.test.ts --maxWorkers=2`，65/65。`desktop:build`（含typecheck）通过；本轮产品源码无改动，不借本轮声明再次跑过全部908项。
