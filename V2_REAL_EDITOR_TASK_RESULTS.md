# V2_REAL_EDITOR_TASK_RESULTS

源码冻结：`066e172c23ecb7f24075d284eacc7b034f3dc36b`（父版本 `3c787b2`），分支 `codex/agent-v2-capability-unlock`，产品版本 `1.0.3`。

**本轮限定离线执行路径验收：16/16组PASS，0 FAIL；其中T1–T10全部PASS，另有6次配对执行作为一组。真实模型：NOT RUN / LIVE STATUS UNVERIFIED。**

环境：macOS Apple Silicon，Electron 44.5.1 / Node 24.21.0 / Chrome 152.0.7977.130；CLI Node见environment.json。原App、Store、Controller、Planner、Runtime、原Registry、AgentTransaction、CommandSystem、Project Serialization、OutputFrameRenderer均真实运行；仅模型transport返回明确受控输入。HTTP尝试0、生产AI IPC尝试0。记录的23次是本机fixture transport调用（包括一个失败动作的空队列恢复尝试），不是模型服务调用或计费。

| 用例组 | 结果 | Fixture请求 | 毫秒（本机执行，非模型延迟） |
|---|---|---:|---:|
| T1-no-selection-rectangle | PASS | 1 | 103.9 |
| T1b-continuous-color-center-rotation | PASS | 1 | 72.9 |
| T2-no-selection-title | PASS | 1 | 49.2 |
| T3-unselected-unique-title-red | PASS | 1 | 51.3 |
| T4-three-RGB-rectangles | PASS | 1 | 70.7 |
| T5-recent-middle-rotation | PASS | 1 | 58.7 |
| T6-title-native-blur | PASS | 1 | 65.3 |
| T7-native-Undo-request | PASS | 0 | 30.5 |
| T8-GUI-current-state | PASS | 1 | 260.5 |
| T9-late-response-project-switch | PASS | 1 | 43.4 |
| T10-exclusive-Cubic | PASS | 1 | 35.3 |
| review-native-star-mask | PASS | 1 | 50.0 |
| remove-effect-forced-review | PASS | 2 | 59.5 |
| failure-partial-draft-isolation | PASS | 2 | 13.2 |
| existing-image-asset-native-tools | PASS | 2 | 92.9 |
| fair-native-controllers-6-runs | PASS | 6 | 1495.8 |

验证说明：

- T1通过实际输入和发送按钮，检查Scene几何、矩形角部及外界Alpha，原生Undo/Redo/保存重读。
- T1b紧接T1，在未选择对象的情况下引用同UUID，改红/居中/两秒旋转；0和0.5秒实际像素、Undo/Redo/保存重载通过。
- T2/T3实际文字身份与红字像素；T4三个矩形类型/数量、位置与RGB中心像素；T5真实rotation关键帧与时间变化像素。
- T6实际原Graph中gaussianBlur与radius=12，不是UI标记；T7原Undo无模型调用，删除效果并能Redo。
- T8在原Inspector输入X/Y并Enter，发送的最新属性确为(500,400)，最终(960,540)。没有仅在Fixture中替换坐标。
- T9实际store.load替换工程，之后旧响应返回；正式Scene及Undo保持不变、任务CANCELLED。
- T10只一层Cubic，保存重载后同UUID；无额外图形。
- Star+Mask与素材创建强制审阅，确认前正式Scene不变；effect删除强制审阅及Undo恢复。
- 已有4×4透明PNG用原asset.add准备，V2通过原createLayer使用素材、调透明度；实际PNG中心Alpha约89（PNG8bit舍入容差2/255），颜色保持洋红，保存嵌入后不丢失。不是新文件系统导入器。
- 无效opacity=2发生在创建后，草稿失败，正式Scene/Undo无部分写入。错误参数/身份覆盖/跨目标propertyId/恢复换工具另由单元覆盖。
- 图层数、目标值、事务历史均有断言；截图不是唯一判断。渲染调用相同Canvas2DRenderer，输入按既有sRGB/8bit Canvas约定，纯色中心精确断言，无色彩管理结论外推。

完整单元 922/922；包括历史A1/B1原响应回归，原错误计划仍安全拒绝且正式Scene不变。原始call29/30单独Replay结果见frozen-response-replay.json，不能记Live PASS。

失败记录保留：首次全量高并发一项100动作测试超5秒，后用--maxWorkers=2重跑全量；初次Electron因生产单实例锁退出，没有验收结果；使用独立userData后通过；Mac初次受限沙箱无法生成DMG，系统权限重跑后成功。均不伪装首次全通过。

连续任务与单步任务均为已知受控响应；没有以原始错误响应Replay冒充新模型能力。

未验证：真实服务/模型规划、Windows实机、实际磁盘GUI对话框与跨进程重启续编。V2 Canary仍NOT READY。


证据目录：`docs/qa/v2-capability-unlock/`；执行脚本：`work/capability-unlock-qa/`。本轮付费 API 调用为0；离线输入不代表模型理解能力。历史 V2-7 报告及原始响应未改。
