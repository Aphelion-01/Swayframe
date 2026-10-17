# Swayframe External AI-to-Composition Workflow

日期：2026-10-16。**通用外部 Agent 工作流已验证（包含明确的原生 GUI 协助）；GPT Work 集成未验证。** 本阶段没有修改产品业务代码、扩展 MCP 工具或调用付费图像/模型 API。

## 基线和实际客户端

独立分支 `codex/external-ai-to-comp-v0`，起点 `23efd55`。已读取 P3 `AI2COMP_MANIFEST_V1.md`、P4 `AI2COMP_EDITOR_UI_REPORT.md`、P6 `SF_MCP_ARCHITECTURE.md` / `SF_MCP_REAL_CLIENT_E2E.md` / `SF_EDITOR_OPERATIONS_CONTRACT.md`、P7 `AI2COMP_V01_RESULT.md` 及真实调用源码。原工作区、冻结 V2-7 和前述报告不重写，见 `docs/qa/external-ai/source-protection.json`。

实际使用两个外部能力：

1. 当前 Codex 的文件和进程工具：编写并运行确定性绘图脚本、生成真实 PNG 和标准 manifest。
2. 独立 Node 进程 `sf-external-node-client`，官方 `@modelcontextprotocol/client@2.3.1`：通过 stdio 启动实际 SF MCP Server，再经鉴权本机 TCP / Electron IPC 操作当前正式页面的 Store。客户端不在 Electron 进程内，不调用 Server 内部函数。

官方[传输规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)与现有 SDK/桥接实现核对后，显式 pin `2026-07-28`；本轮捕获的 wireVersions 为 `modern`、`2026-07-28`。不是依据配置字符串假定协商成功。这里只使用现有六项工具，发现七项；`sf_selection` 未调用，不声称七项全部本轮复测。

## A—J 实际产物和调用

| 阶段 | 实际完成 |
|---|---|
| A 外部素材 | NASA astronaut 真实照片，沿用 P7 已核对来源；Codex 本地生成深色科技背景、排版和线性装饰，无付费生图 |
| B 真实分层 | 重新运行 P7 Apple Vision，实际人物 Alpha；本地绘图输出 Background / Circuit accents / Main Subject / Title 四张 PNG |
| C manifest | `docs/qa/external-ai/composition/manifest.json`，P3 v1、960×540、straight RGBA8、sRGB、bottom-to-top |
| D 严格校验 | 原生 P3 Reader 在正式 Scene 提交前校验路径、manifest、RGBA PNG、实际尺寸和包容量，不自写宽松校验替代 |
| E 导入 | `sf_import_layer_package` 对显式工程/合成/授权目录调用原 Importer 和 Transaction，四层导入；原生 Undo/Redo 验证 |
| F 读取 | `sf_scene_tree` / `sf_inspect_layer` 读取真实 UUID、顺序、类型、属性；结果归档 |
| G 编辑 | MCP 将主体位置从 (740,285) 改为 (710,293)，GUI Inspector 的 X=710；标题/背景分别改透明度再恢复 |
| H 动画 | GUI 的“开启位置动画”建立首关键帧；MCP 在 1秒写 (764,281)，原编辑语义自动添加第二关键帧 |
| I 渲染 | MCP `sf_render_frame` 输出 t=0 / t=1 的实际 SF Renderer PNG，并在保存重开后再渲染 t=1 |
| J 检查 | 对比外部参考、导入图和动画独立预期，最大单通道差1（容差2）；动画变化93878像素，仅在主体范围内 |

合成可直接打开：`docs/qa/external-ai/workflow.swayframe`。图片已内嵌，不依赖源包。标准包可直接通过 SF“文件 → 导入分层合成…”导入；MCP 导入要求先有同尺寸原生合成，这是现有工具能力边界。

## 字体、文字与形状

已有原生 Text Layer 存在于 `src/core/project-model.ts` 的文本类型及 `src/ui/inspector-sections.tsx`，但 P3 v1 只有 raster，当前 MCP 不提供新建文字/静态文字修改。没有从参考图可靠恢复字体的通用 OCR 或重建器。本例由脚本明确排版 `ORBIT SYSTEMS`，使用本机 Arial Bold 后烘焙成**独立 Raster Title**，可移动/缩放/改透明度/动画，不能在 SF 中逐字改标题或字体。没有伪装为原生可编辑文字。

简单线条、圆弧、网格由脚本明确定义并烘焙在独立 Decoration / Background；本轮没有形状识别或通用 PSD/Figma 重建，没有材质/玻璃/发光恢复。

## 必要用户操作与未自动化边界

实际验收由 UI 驱动器点击真实设置控件：主动启用 MCP、勾选编辑/导入权限、通过原生文件夹入口授权唯一包目录。系统选择器程序化选择自有 fixture，不是人工点选验证。连接配置仅由受控父子进程 IPC 传递，不落盘、不截图、不加入命令参数。

首次开启位置动画由真实 Inspector 控件完成；保存、关闭/重开、Undo/Redo也走真实 GUI。**因此不是纯 MCP 全自动建动画演示**，也不是 Codex 原生 MCP 插件安装验收。没有增加脚本执行工具、直接暴露 Store 或为了演示绕过接口。

## 交付索引

- [真实客户端 E2E](SF_AI_TO_COMP_REAL_E2E.md)
- [视觉对比](SF_AI_TO_COMP_VISUAL_COMPARISON.md)
- [GPT Work 可行性与未验证边界](SF_WORK_INTEGRATION_FEASIBILITY.md)
- `docs/qa/external-ai/final-run/`：真实调用、返回、Scene Tree、Inspector、截图、渲染、25项结果。
- `work/external-ai-qa/`：生成、真实客户端、GUI驱动、独立像素诊断；不进入安装包。

本轮只新增工作流脚本、报告与真实样例。产品源码与起点相同，按用户持续要求重新生成相同产品源码的1.0.3 Mac/Windows候选安装包；不把验证报告包装成“新功能版本”。安装包未签名、Mac未公证，Windows无实机运行证据；摘要及SHA见`docs/qa/external-ai/installers.json`。Windows和GPT Work均无本轮实机集成证据。
