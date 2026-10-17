# Swayframe AI Release Readiness

**最终：NO-GO（统一AI正式发布）。** 可对AI2Comp Import和MCP Bridge作下述限定GO，不批准Agent V2 Canary、不批准V2替代V1、不批准通用自动分层发布。

## 模块分别判断

| 模块 | 判定 | 允许范围 / 阻断项 |
|---|---|---|
| Agent V2 | **NOT READY** | V2-7.1离线修复及本轮交错隔离通过；没有新Live预算/证据，不能判断真实创建可靠性或Canary Ready |
| AI2Comp Import | **READY** | 仅本轮验证的Mac桌面、严格manifest v1、RGBA8 straight sRGB PNG、资源/20MB保存上限；可Undo/Redo、保存重开和渲染 |
| MCP Bridge | **READY** | 仅显式用户启用、本机loopback、一个可信客户端、本次限定权限、七项既有工具；默认关闭。非远程/多用户/全部Host认证 |
| Automatic Layer Separation | **NOT READY** | Mac受限原型可以保留实验入口和明确限制；毛发/混色边、背景透明洞、最长1024和平台边界不支持一般“还原分层”发布 |

上述两个READY都是指定范围，不代表Windows实机已通过或安装包已签名；Windows只生成并作静态完整性校验。对外统一宣传“全部AI已就绪”仍为NO-GO。

## 证据而非单一成功率

本轮最终Electron127/127，单元908/908，跨入口像素/变化范围5/5。Agent V2-7.1定向19项是908子集。初始旧菜单QA为19/20，修正本轮定位后扩展21/21；Agent QA编译错误在启动前修正。日志及失败原样保留，详见SF_AI_FINAL_ACCEPTANCE.md。

原Frozen Live A1/B1仍是历史FAIL；当前精确原响应离线复验拒绝两个错误方案，正式Scene/Undo不变。此“拒绝正确”不能替代新模型成功创建。旧8/10任务成功不能抹掉2个前置失败及6个NOT_RUN。

自动分层工程安全通过和原位重合一致不证明蒙版准确，没有GT mask或通用准确率。未知隐藏像素不恢复，不能用本机小样本推导任意图片/跨平台质量。

## 发布约束保持

1. `defaultAgentRuntime='legacy-v1'`及原UI fallback均未改；V1保持默认，无默认切换批准。
2. MCP启动off，用户主动选权限/授权目录并启用；不保存授权，换工程/关闭/断开需重新授权。
3. AI2Comp正式提交可单笔撤销；共享Asset不物理删除，保存嵌入而非临时链接。
4. 自动分层最长1024、软边混色/未补全背景/双层分组/平台限制在确认前可见。
5. 发生正式Scene污染、资产丢失、失效Undo/保存或未授权写入的严重复现，立即阻断对应模块，不以总体通过率放行。

## 进入下一轮的最小顺序（不是本轮开发）

- 保留本轮冻结，不增加Planner/Registry/Gateway或新功能。
- 若要批准V2 Canary：先获得独立Live预算及可执行计费限制，按固定A1/B1及既有PASS任务验证实际模型输出、草稿/接受/渲染，保留首次失败。没有预算本轮不调用。
- 若要发布通用自动分层：先定义可接受的实际图片类别/边缘质量标准和失败提示；补全、精细matting或跨平台后端需另立实现与许可验证，不能由此授权开发。
- 若目标包含Windows或特定第三方Host/GPT Work：在对应真实运行环境单独实测；本机Node客户端不能代替。

## 安装包

按用户长期要求生成Mac arm64 DMG、Windows x64 NSIS，仍为1.0.3同一产品源码的**最终验收诊断候选**。它们不是统一AI正式发布，不上传或合并为稳定版本。包内25个运行文件每端逐字节比对、Mac helper校验、DMG checksum与Windows PE结构/哈希均留在`docs/qa/ai-final/`。

unsigned / Mac未公证 / Windows实机未验证。最终审计不需要新增付费API、公共插件、远程隧道或新产品功能。
