# Assistant Chat 1.0.4 — 验证记录

## 环境与边界

2026-10-17，Mac arm64；精确 Electron / Node / Chromium 版本见 `electron/report.json`。源码起点 `eacb25d`，最终源码提交及文件摘要见 `freeze.json`。所有测试采用独立临时工程和用户目录，未重启用户正在运行的 SF。

模型响应为测试夹具，绝非 Live。测试 bundle 只在 `getAIApplication` 的依赖边界注入离线 ProviderManager；所有编辑、状态、校验、事务、Undo、保存和 Renderer 都使用产品代码。原生模型 IPC 与 HTTP 网络被阻断，最终计数见报告。

## 运行

```sh
npm run typecheck
npm run lint
npm test -- --maxWorkers=1 --reporter=json --outputFile=docs/qa/assistant-chat/unit.json
npm run desktop:build
node work/assistant-chat-qa/build.mjs
SWAYFRAME_USER_DATA=/private/tmp/sf-assistant-chat-qa-unique /path/to/Electron work/assistant-chat-qa/.compiled/desktop-dist/main.cjs
node work/assistant-chat-qa/package-integrity.cjs
```

## 检查内容

单元与集成测试的精确数量及每项状态见 `unit.json`。新增 `tests/assistant-chat.test.tsx` 覆盖同名对象 ID 引用、只编辑指定层、未接受草稿不提交、清空不影响 Undo、真实模型路由、Skill / 深度进入 Planner、文件读取晚到、停止晚到请求、参数自纠错、原始计划重生成、网络与认证分类、不可用 Skill 不阻塞输入区。

Electron `report.json` 包含逐组结果、请求数与原始离线输入、操作状态、Scene 和 V1/V2 像素对照。包括已有无选中创建、渐变、标题、RGB、旋转、效果、原生 Undo、GUI 交错、工程切换晚到、失败隔离、遮罩、图片、保存重载，以及新增聊天引用、文件上传、停止、参数修复、缺失计划反馈恢复、V1 图标发送与审阅。

- `UI-1280x720.png`、`UI-1440x900.png`、`UI-1920x1080.png`、`UI-2560x1440.png`：实际指定 viewport；检查输入区在助手范围内、无横向溢出、消息独立滚动、没有双重文本框边框。
- `chat-message-reference.png` / `chat-working.png` / `chat-model-popover.png` / `chat-recovered.png`：对象引用、进度、选择器和修复结果。
- `chat-edited-render.png` / `chat-recovery-render.png` / `chat-V1-render.png`：真实 OutputFrameRenderer 输出。
- `initial-harness-failure.json`：首次新增脚本错误调用不存在的 `store.open`；已改为产品 `store.load`，属于测试脚本缺陷，未当作产品 PASS。后续 V1 补验还修正了夹具配置注入和等待真实审阅按钮；均未降低产品校验。

## UX 复核

| 检查 | 结果 |
| --- | --- |
| 功能位置 | 仅 assistant.actions，六个 scoped Command 与 Feature 元数据，已更新两个功能清单；无全局按钮增量 |
| 简洁与任务聚焦 | 只显示会话、当前状态及输入区；步骤 / 诊断默认折叠，旧示例二级收纳 |
| 系统状态可见 | Runtime 实际阶段，失败安全原因，停止始终在执行中可用 |
| 对象辨识 | 名称高亮、稳定 ID 绑定；重名不导致选错 |
| 防错与撤销 | 草稿先验证、原生 Undo，清空上下文不删除工程历史 |
| 键盘与图标 | 可访问名称、Enter / Shift+Enter、IME 防误发、Escape / 外部点击收起选择器、图标焦点与按压反馈 |
| 动效 | 轻量消息 / 标签入场和状态点；reduced-motion 关闭 |
| 分辨率 | 四种尺寸真实截图与几何断言 |

未发现本轮正式 Scene 污染、Undo 异常或保存丢失。不得据此宣称任意自然语言任务都能完成。未付费 Live 复验，第三方服务兼容性和服务端内部推理模式不作新保证。Windows 包只验证结构与载荷，未在 Windows 实机运行。

## 压力运行说明

并行进行打包和全套测试时，已有的 100 次创建 / 5000ms 边界测试曾超时（`unit-under-load.json`），未出现语义断言失败。最终停止竞争任务，使用 `--maxWorkers=1` 重跑原断言与原超时；最终结论仅依据 `unit.json`，未放宽测试阈值。末次 Feature 频率元数据调整另跑 `registry.json`，保持业务代码不变。

最终结果：941/941 全套测试通过；8/8 功能位置与注册检查通过；23/23 Electron 组通过；网络请求与原生付费模型 IPC 调用均为 0。

最终仅将 V1 Provider 说明改为默认折叠的处理记录；另跑 `ui-final.json` 的 23 项 UI / 恢复检查及完整 23 组 Electron，均通过。最终包均包含该修正。
