# V2_NO_SELECTION_E2E

源码冻结：`066e172c23ecb7f24075d284eacc7b034f3dc36b`（父版本 `3c787b2`），分支 `codex/agent-v2-capability-unlock`，产品版本 `1.0.3`。

**OFFLINE ELECTRON EXECUTION VERIFIED；LIVE STATUS UNVERIFIED。**

实际Electron使用原生产main/preload及App，内存测试工程、原AIProviderManager transport返回受控动作；网络及生产AI IPC双重禁止。Renderer没有Mock。

| 用例 | 无Selection / 不输入layerId | 正式Scene与像素 | Undo/Redo/保存重载 |
|---|---|---|---|
| T1 创建矩形 | 是，真实Textarea+发送按钮 | 恰好一个shapeKind=rectangle，160×100；两个内部角点Alpha255、外部点Alpha0 | 实际Undo恢复之前、Redo逐字一致、store.save/load后UUID/Scene保持 |
| T1b 连续改红、居中、旋转 | 是，承接T1同UUID | 原生4动作、0/0.5秒像素变化 | 实际Undo/Redo/保存重载一致 |
| T2 创建Swayframe标题 | 是 | 实际Text Layer、text=Swayframe，输出PNG | 延续实际Scene，不假造对象 |
| T3 唯一标题改红 | 是 | host从真实Scene唯一匹配，填充值[1,0,0,1]；真实红色字像素 | 正式事务 |
| T4 三个红绿蓝矩形 | 是 | 正式Scene恰好新增3层；各中心像素对应纯RGB，横向位置正确 | 同一次原事务 |
| T5 上轮中间矩形旋转 | 是 | 可靠近期创建序列取中间UUID，0/2秒为0/360度；0与0.5秒边缘像素发生预期变化 | 不重建对象 |
| T10 只创建Cubic | 是 | 恰好一个真实Text、无额外对象 | Undo/Redo及保存重载一致 |

T1/T10实际重载测试走原EditorStore.save/load与Project Serialization，未点击磁盘保存对话框；不是“从操作系统重新启动应用”的验证。T8通过真实Inspector数值输入与Enter提交用户移动，再检查发送给Planner的值为最新(500,400)。

存在多个同名/同类候选或多个明确UUID时仍需澄清；不会因无Selection盲改多个对象。名称/UUID/星形类型/已删除序号/Undo后续操作在单元回归中覆盖。唯一目标可直接定位，不代表模型规划已可靠。

样例：`electron/T1-no-selection-rectangle.png`、`T1-rectangle.png`、`T3-title-red.png`、`T4-RGB.png`、`T5-rotation-quarter.png`、`T10-Cubic.png`。步骤、受控动作、Scene及Provider输入保留在electron/report.json。


证据目录：`docs/qa/v2-capability-unlock/`；执行脚本：`work/capability-unlock-qa/`。本轮付费 API 调用为0；离线输入不代表模型理解能力。历史 V2-7 报告及原始响应未改。
