# Agent Graph Construction V0.4

复用 CompositingGraph、现有 Graph 命令、compileGraph、CanvasGraphBackend 与 Declarative Pixel Runtime。

原生 createNode 使用注册类型及真实输入/输出端口。connectNodes 校验方向、类型、单输入容量与环；setGraphOutput 根据真实 Output Image 端口连接末端，不猜测新图层自动生成的 Output ID。生成器分支通过 merge 的 a 前景/b 背景组合，禁止用不相关纹理替换原本请求的渐变。

reuseProgrammableEffect 仅使用已验证示例或正式用户库中的精确 id/version/contentHash，包内嵌工程；它不创建新算法或改写源代码。后续参数沿用 Property/Keyframe。发现能力不代表任意 effect type 都可用 createNode，声明式包通过复用工具实例化。

renameGraphNode 提供语义名称；layoutGraph 按实际 DAG 的最长上游深度分列，260px 列距、220px 行距，稳定排序。保持 Node IDs、参数、端口与连接；这是基础自动布局，不是最优布线或 Node Group。

Prompt-to-Composition 使用原生图层创建、属性编辑和 addKeyframe/setInterpolation/applyMotionCurve；文字保留 Text Layer。临时预览经过既有 Renderer，接受前 Graph 必须可编译，错误效果沿用原有导出阻断。未关联的节点仍保留，不因 Agent 重建整图而删除。

当前 Graph 的 group 字段不存在，检查返回 null；未实现的群组和外部图像/视频生成没有伪入口。Noise 验收夹具使用已验证 organicTexture 正弦有机纹理近似，报告明确标注；不是新增真正流体噪声算法。


0.9.20 续轮：真实 deepseek-flash 单节点修改及原生创作/背景分支修改的数据闭环已通过；具体边界见 AGENT_CREATION_TEST_REPORT.md。Graph 摘要限制16,000字符，细节按需检查；正式 Scope 验证仍读取完整 Project。规划错误最多有限重新生成，拒绝内容不执行、不放宽权限。
