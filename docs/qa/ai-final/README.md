# SF AI Integration Final Acceptance evidence

总体NO-GO；限定Mac的AI2Comp Import/MCP Bridge GO；Agent V2、通用Automatic Layer Separation NOT READY。V1默认/MCP默认off不变，无付费模型请求。

- summary.json：最终127个Electron case、908单元及集成、5图像诊断；不合并为单一模型成功率。
- prerequisites/P0、prerequisite-reports.json：37份前置报告原文快照或hash；保留旧NO-GO的历史语境。
- inputs.json：原A1/B1及5个历史PASS响应、PNG包/照片的基线文件hash。
- replay-frozen/fixed.json：同原始模型响应的离线前后行为，不是新的Live。
- native/current：17项真实内核+新进程1项；failure-log、Scene对比、PNG及原生工程。
- cross/run：正式dist/preload，独立Node MCP客户端29项及工具返回、GUI截图和真实PNG；visual-report5项。work/final-cross-qa/main.ts只含固定QA动作，不是产品eval入口。
- import-ui：15项原生React控件/预览/取消/编辑/保存，独立重开1项，关闭1项。
- mcp/current：14项真实SDK协议/权限/并发；window-close为独立客户端5项，监听释放。
- import/runs/verified：21项真实导入/像素/资产共享/预算拒绝/事务回滚，独立重开1项。current是过期菜单定位的19/20失败运行，不覆盖。
- agent-electron：5项真实App/Controller/Runtime/Command/Renderer，受控离线Provider，不冒充Live。原生GUI交错/切工程/取消晚到均保留新用户状态。
- separation/current：17项真实本地Vision及P3/P4，含stage写失败/坏图/晚到。原照片和所有原始mask/缺口输出保留，不能作为训练其他AI模型的数据。
- all-tests.json、unit-generated：908回归结果及历史命名输出的新副本；旧tracked生成文件仅在本新worktree恢复至基线，历史账本不改。
- source-protection.json、artifact-hashes.json：产品及冻结证据保护和本轮产物hash。

环境、命令、安装包、失败原因详见对应JSON/日志及根目录四份报告。系统对话框程序化选取受控目录，不冒充完整人工鼠标验收；真实IO/PNG解码/Renderer/Command/保存运行。Windows、GPT Work、强杀/真实磁盘满等未验证。不把安装包生成当作正式发布批准。
