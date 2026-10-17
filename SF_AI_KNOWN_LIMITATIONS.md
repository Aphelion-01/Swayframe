# Swayframe AI Known Limitations

冻结运行基线：3cc53a59d32ed021aaf58d5274a564950721ac28。日期：2026-10-16。以下限制不能被本轮通过数量抵消。

| 项目 | 状态 | 具体边界 |
|---|---|---|
| Agent V2真实模型创建可靠性 | **LIVE STATUS UNVERIFIED / NOT READY** | 新调用0；A1/B1原始错误方案离线安全拒绝不等于新模型创建成功 |
| V2通用自然语言语义约束 | 部分实现 | 创建数量/类别仅保守解析明确中文子句，不是全部“只/不要”副作用的通用理解；不同ID合法重复不静默删 |
| V2原冻版任务A2～A4/B2～B4 | **NOT RUN** | 旧前置失败，未伪造Scene补跑；本轮不标Live PASS |
| V2重新规划 | 离线控制流已验 | 正确恢复响应是明确夹具；真实模型可能继续出错。失败队列响应不能计为真实服务故障率 |
| 自动分层一般发布 | **NOT READY** | 最长边1024，非精细matting；胡须/飞发缺失，软边原背景混色，移动可露残边 |
| 隐藏背景/身体补全、Inpainting | **NOT IMPLEMENTED** | 主体内部背景留透明洞，生成隐藏像素0；不承诺恢复照片不存在的信息 |
| 可选Foreground/深度分层 | **NOT IMPLEMENTED** | 检出实例合并Main Subject，只有Background+Main Subject，不保证每个物体独立 |
| Windows自动分层 | **NOT IMPLEMENTED** | 本机公共Vision仅Apple Silicon Mac / macOS14+；Windows入口禁用 |
| Windows编辑器/MCP实机 | **NOT VERIFIED** | 有安装包及静态校验，不能推导运行PASS |
| 图层包格式 | 已实现但受限 | strict v1、最多32层、单PNG8MB/包12MB、工程20MB；RGBA8/非隔行/straight/sRGB。ICC、APNG、16bit、脚本、私有扩展不支持 |
| AI2Comp原生文字自动重建 | **NOT IMPLEMENTED** | SF自身有Text能力；当前包只有raster。科技标题是Raster，可变换/动画，不能逐字/改字体 |
| 通用PSD/Figma/复杂材质重建 | **NOT IMPLEMENTED** | 不从纹理/发光/玻璃自动恢复矢量或材质；复杂图像继续Raster |
| MCP首次开启动画/保存工具 | **NOT IMPLEMENTED** | 既有属性有关键帧时能继续写入；首次秒表和保存/重开走原GUI，不冒充纯MCP全自动 |
| GPT Work专属SF集成 | **NOT IMPLEMENTED / NOT VERIFIED** | 当前只验证通用客户端；未执行Work工具调用，不代表平台本身没有能力 |
| 公网/远程MCP、任意代码/脚本/fs写 | **NOT IMPLEMENTED（有意禁止）** | 只开放本机七工具；不得把loopback转发当通过安全审查 |
| MCP持久exactly-once | 未承诺 | 去重表每宿主最多256请求，不跨重启；已提交后断开为结果可能未知，不能盲目重试 |
| 跨文件系统/Scene万能事务、物理GC | **NOT IMPLEMENTED** | P3内存准备/嵌入，P7自己的stage发布；Scene Undo不删除用户导出包或共享原文件 |
| 线性光/HDR/ICC/全媒体像素一致 | **NOT VERIFIED** | 本轮sRGB编码值Canvas source-over、RGBA8容差2，不是全色彩管线认证 |
| OS强杀/崩溃/实机磁盘满/压力/恶意本地进程 | **NOT VERIFIED** | 正常关闭、受控IO晚到、写失败注入已测，不推导所有系统故障 |
| 签名、公证、正式分发认证 | **NOT IMPLEMENTED** | 本轮安装包为未签名诊断候选；不是正式版本发布批准 |

人工修正边界：原Mask可裁剪/羽化，但不能找回已丢失像素或隐藏背景。可外部修正输出PNG，再按严格格式重导；不能开发者脚本临时显示几层就算导入完成。本轮工程无需人工修复；用户等价权限设置、选择目录、GUI秒表和保存动作属于明确工作流协助，不是修复数据。

未报告单一“总体成功率”。当前总体NO-GO；范围内的Import/MCP GO和未就绪的Agent/自动分层分别记录。任何后续严重工程损坏复现均优先于统计数量。
