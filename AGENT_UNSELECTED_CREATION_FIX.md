# Agent 无选区创建入口修复

源码：fac19a631bff2048af5a9aa36f34f37397f454d7，分支codex/agent-unselected-creation-fix，版本1.0.3。

## 真实根因

通过当前/Applications/Swayframe.app的原生可访问性界面读取：V2直接模式、正式合成0图层；原输入“创建一个梯度渐变的正方形”，显示“本轮请求未启动”及“没有有效目标，请选择当前工程中的图层”。原ConversationSession.resolveRequest依赖起始短语、14字符距离及有限名词，未包含正方形；因此在模型调用前失败。这次有真实原始请求与报错证据，不是推测模型权限不足。

## 修复和权限

- session.ts:resolveRequest按明确的创建操作识别，不再要求固定开头、短距离和特定对象名。支持正方形/圆形及自然请求前缀；否定创建、历史“刚才创建的…”、仅添加效果/关键帧等不被误当新图层授权。
- 无选区效果操作可定位当前Scene唯一图层；多个候选仍澄清，已删除、锁定、错误工程身份、非目标对象保护不解除。
- planner.ts传达square→rectangle等原生几何约定，明确仅可通过原生工具编辑工程。
- 既有44个有限工具、严格Action Schema、原Registry/Command/Transaction/Undo不变；不开放源码写入、任意文件写入、Shell、eval或脚本执行。未知writeFile/execute_js/shell/modifySource工具在Schema被拒绝。

## 实测

- 完整单元930/930，定向110/110，typecheck/lint/desktop:build通过。
- 真实Electron17组通过；原请求在实际输入框发送，Selection真实为空，受控响应经原Controller/Planner/Runtime/Registry/Command提交真实等宽高矩形和线性渐变，角部像素/Undo/Redo/保存重载通过。唯一图层添加模糊无需Selection；含GUI交错、工程切换、效果审阅等原回归。
- 模型transport是明确离线夹具；HTTP和AI IPC调用0，未使用付费API，不能宣称新Live模型规划成功。
- 初次附加测试失败记录保留：渐变转纯色夹具漏传gradient=none；另一轮继承旧QA的store.select([])错误用法，实际接口应为select(null)。最终全部更正并断言selection.length===0；没有放松产品校验。旧历史报告不重写，也不沿用其错误选择状态作新证据。

## 安装与现场

两端安装包已重建，每端25运行文件逐字节一致。当前/Applications/Swayframe.app已更新且app.asar哈希与新候选一致，原程序保留在release/previous-installed-before-unselected-fix.app；未改凭据或已有工程文件。更新前空工程0图层、无未保存修改；重启后恢复V2直接模式及原请求文字，未点击发送，不触发模型计费。V1全局默认不变，仅恢复用户此前明确选择。

Windows只构建/静态校验；两端未签名，Mac未公证。安装与哈希见docs/qa/agent-unselected-fix/installed-update.json、installers.json及package-integrity.json。原用户dirty工作区未改，V2-7冻结报告未覆盖。
