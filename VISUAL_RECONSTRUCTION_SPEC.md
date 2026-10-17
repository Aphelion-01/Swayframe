# Visual Reconstruction Spec — V0.4.1

参考资源：outputs/agent-reliability-023/reference.png，为用户提供的410×230 Cubic图片；真实 Provider 验收使用独立820×460合成，不读取或删除用户作品。

流程：当前真实参考帧 → analyzeReference / ReferenceAnalysis → 查已有能力 → 提交 typed creation tasks / AgentPlan → 注册工具预检与沙箱 Command → 共享 Renderer 实际PNG → 参考与结果共同视觉检查 → 有界局部修正 → 用户接受 / 一次Undo。参考图、分析与迭代状态均在 Session，不进入 Scene。

ReferenceAnalysis 记录画布、每个视觉元素的类型/边界/位置/层序/几何/颜色/渐变/效果/文字/依赖/原生映射/置信度、空间关系和限制。分析由真实视觉模型返回，生产中没有 Cubic 固定描述模板。二维透视深度是推测，允许低置信度。不可用模型/参考加载失败/范围不允许均应阻止假完成。

Cubic验收阶段：背景与透视面几何；青绿正面与暗侧面渐变；局部柔边及阴影；可编辑Cubic标题；中文副标题；合成排版；渲染比对与最多3轮修正。可用二维透视路径重建，不能普通矩形冒充几何，不能直接以参考图片图层冒充可编辑复刻。

用户后续“右侧太亮、柔化边缘、不要修改文字”：定位既有侧面/模糊参数；文字图层全部属性深度相等；单次Undo恢复修改。效果优先native/reuse/compose，确实缺失才Forge；不扩建三维建模引擎。

## 原生几何与外观执行契约（0.9.26）
createPath 的 position 是合成中的层内原点；points 的所有坐标以该原点为中心，控制点为绝对坐标。直线顶点为 `[x,y,x,y,x,y]`。参考图 bounds 应按合成尺寸同比映射，不能直接把参考坐标当当前合成坐标。
透视路径渐变优先通过 setFill 的 gradient / radialParameters 修改原生填充，再使用现有下游效果。单独 createNode(radialGradient) 不修改路径填充，未接输出不会出现；接输出后生成矩形图像，不能隐含当作保留形状 alpha。
