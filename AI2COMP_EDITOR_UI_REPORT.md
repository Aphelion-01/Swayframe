# AI2Comp V0 Editor Integration

结论：限定的桌面 Layer Package v1 PNG 导入体验已完成。真实菜单可以触发文件夹选择、预览和确认，不需要开发者脚本才能导入。Mac Electron 指定编辑路径及异常自动验收通过；Windows 安装运行未验证，不能推导为全平台 PASS。

## 基线与范围

- 独立目录：`/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/ai2comp-editor-v0`，分支 `codex/ai2comp-editor-v0`，起点 `3efe613`。
- 已核对 P0 五份审计、P1 三份验收报告及 P3 五份导入报告。P0 的旧缺陷结论由 P1/P3 定向修复和证据承接，不重写历史报告。
- 原 dirty 工作区和原 1.0.3/P3 工作树保持原样。核心 Scene/Command/Renderer、Agent V1/V2 及冻结证据与 P3 起点无差异，见 `docs/qa/ai2comp-editor/source-protection.json`。
- 没有 AI 图像生成、自动分割、MCP、Agent 重构、第二编辑器/属性/动画系统或付费模型调用。

## 入口与位置审查

对象 Asset/Composition；任务导入并继续编辑；频率 F4；合成编辑上下文；九域归属 PROJECT；唯一规范入口为原 `menu.file`。

文件 → **导入分层合成…**。沿用 `import-layerpack` Command ID 和命令搜索，次级位置 `dialog.actions`。`src/shared/feature-catalog.ts` 仅放元数据，业务仍由原 Editor Command Registry 绑定；`FEATURE_INVENTORY.md` / `FEATURE_LOCATION_MATRIX.md` 已同步。没有增加常驻工具栏按钮；Web 版仍禁用此原生目录能力。

## UI 与状态

`src/ui/LayerPackImportDialog.tsx::LayerPackImportDialog` 使用原 `Modal`，不是独立编辑器。`choose` 调用原 `src/importers/layerpack-import.ts::importLayerPack`，由 `confirm` 等待用户决定。

| 状态 | 行为 |
|---|---|
| 选择文件夹 | 打开实际系统目录选择器；标题无需用户理解 manifest |
| 校验中 | 显示检查提示和进度标记；不改 Scene；可取消 |
| 可以导入 | 显示画布尺寸、图层数量、素材完整性、可导入状态、每层缩略图/名称/尺寸/透明度和顶层→底层顺序 |
| 导入中 | 明确更新 UI 后让出一次事件循环，提交前再次检查取消/工程归属 |
| 成功 | 关闭预览，原状态栏报告成功及图层数量，显示原图层面板和时间轴 |
| 失败 | 易理解的原因和重选建议；详细原因可展开；确认按钮禁用 |
| 已取消 | 明确未修改工程，可关闭或重新选择；Esc/点击外部也会终止待确认任务 |

坏包未获得完整可信预览时，尺寸/数量显示“无法读取”，不会猜测并展示未经验证的图层。缺图显示“缺少图片，无法导入”，详细原因保留具体文件名。没有静默跳过坏图。

## 原生编辑与隔离

1. 原 NativeServices / FileGrants / PNG 校验、位图解码、内嵌 Asset 准备不变。
2. 确认前用原 `CommandSystem.executeTransaction` 作候选预检；临时实例只复用现有内核，不发布正式 Scene/Undo，也不是另一套实现。
3. 确认后唯一正式写入是 `EditorStore.run` 的现有 Transaction（assets + composition/layers + activate）；仍有原 Schema 和 20 MB 可保存性校验。
4. 原 Inspector / AnimatedField、原 Timeline、原 Undo/Redo、原 ProjectService 保存重开和 Canvas2DRenderer 继续使用同一 Scene。
5. 待确认预览订阅工程快照。切换工程/其他 Scene 修改使预览失效。重复打开只聚焦已有对话框；确认回调消费一次；正式提交前再次核对 owner 与 signal。
6. 窗口关闭先取消 native jobs，renderer 收到原 close action 也终止待导入。仅取消这次导入；不清理用户素材。
7. 资产仍采用 P3 的内存准备→一次 Scene 发布→保存时嵌入工程。无新的磁盘素材复制，因此不存在待回滚的半份复制文件；共享素材物理文件不会被 Undo 删除。

## UX 复核

应用 `professional-creative-editor-ui` 与 `ux-heuristics`，针对本导入流程评分 **9/10**，最高剩余问题 severity 1：极长图层名用省略号和完整 title，键盘视觉查看长名称仍可改善为换行/可展开名称。无已发现的 severity 3+ 流程阻断；此评分不是全软件可用性认证。

- 单一主操作“确认导入”；取消、重选和错误恢复清晰；不依赖颜色表达能否导入。
- 确认前不改变工程；成功后可立即一次 Undo；失败不关闭预览或假装成功。
- 复用 Modal 焦点圈定/返回、Escape，实际 Electron 自动验收覆盖 Escape；系统选择器取消另有真实操作证据。未声称完整读屏器审计。
- 1280×720、1440×900、1920×1080、2560×1440：实际 Chromium 视口、弹窗边界、无横向溢出断言通过，截图位于 `docs/qa/ai2comp-editor/run/preview-*.png`。大视口通过 Chromium Emulation/CDP 获取完整实际页面，不冒充物理显示器分辨率。
- 第二轮专业密度审查：沿用既有 token、按钮、Modal 和五区布局，未扩大永久入口。
- 第三轮最终审查：修正 `.new-dialog` 覆盖导入宽度的选择器；修正 React 批处理合并“导入中”状态的问题，实际提交前取消回归通过。

## 质量与交付

- 完整测试 870/870（含新增 5 个确认/取消边界测试）；registry/placement 原断言保留。
- `npm run lint`、`npm run typecheck`（含 desktop:build）、`npm run desktop:build` 通过。
- 真正 Electron 编辑及异常自动用例 15/15；独立进程重开编辑 1/1；关闭窗口 1/1。详见 `AI2COMP_ELECTRON_E2E.md`，不能把受控文件选择结果当人工系统选择器通过。
- Mac arm64 DMG 和 Win x64 NSIS 已生成；每端 21 个运行文件与当前构建字节一致；DMG checksum 和 Win PE 结构检查通过。版本沿用 1.0.3 的独立功能候选，未覆盖旧目录安装包。两端未签名，Mac 未公证；Windows 实机未测。
- 无付费 API、无外部网络；Agent V1 默认、V2 Canary 状态保持不变。
