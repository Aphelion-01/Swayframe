# Core Execution Skill V1

id sf.core-execution；版本 1.0.0；runtime 1。入口：NativeSkillRuntime.route；正式执行：既有 AgentOrchestrator → AgentTransaction → CommandSystem。Core 提供发现、规划、校验、解析、编译、草稿执行、验证、提交顺序；没有新 Scene 或第二套 Orchestrator。

机器检查由原 schema、依赖图、scope/基线、真实结果绑定、聚合命令验证、动画有限数值求值和 compileGraph 负责。native-render 在实际 Canvas 存在时生成像素证据；无 Canvas 不能报告渲染通过。text-visible 是视觉目标，基础文字结构/参数可验证，但仅有文字存在或 PNG 不能证明视觉正确；独立视觉比较仍单列 NOT_VERIFIED。

高频技能：Shape Creation（原生形状）、Typography（可编辑文字/字体）、Gradient Fill（同源正式填充）、Keyframe Animation（真实关键帧/曲线）、Compositing（真实节点、端口、Output）。每个技能列明 requiredCapabilities，测试通过共享 runtime，不使用外部脚本。
