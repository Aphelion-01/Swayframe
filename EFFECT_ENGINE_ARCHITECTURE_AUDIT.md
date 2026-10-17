# V0.3 Unified Effect Engine：升级前架构审计

基线提交：18a0eb9（0.9.17）。本审计依据当前仓库代码，而非历史需求中的能力描述。

| 系统 | 实际实现 | 升级边界 |
| --- | --- | --- |
| Renderer | `Canvas2DRenderer`；`draw-content.ts` 绘制二维，`perspective-plane.ts` 投影平面，`model-mesh.ts` CPU 投影三角面；three 用于模型导入，不是主渲染器 | 不替换主渲染器，不假设已有 WebGPU/WGSL |
| Effects | `effect-definitions.ts` 十种固定 EffectKind，参数限 number；`effect-registry.ts` 是可搜索适配器 | 保持旧 ID 和默认值，增加类型、端口、版本、实现引用 |
| 执行 | CanvasGraphBackend.effect → applyEffects；模糊/阴影/发光用 Canvas filter/shadow，颜色用像素运算 | 栈/图已经调用同一算法，不重写正确的模糊 |
| User Graph | Source/Output/直通/纯色/变换/遮罩/Merge/十种效果，强类型端口、DAG 校验 | Source 不强制参与输出，可支持无输入 Generator；多输入 Merge 已存在 |
| Single source of truth | 0.5 起 `editor.graph`；旧 effects 迁移为图，拒绝同时保存两份；linearGraphEffects 仅映射严格单链 | 继续以图为正式处理数据；分支不压平，Fill 归 Appearance |
| Render Graph | compileGraph 拓扑计划、WeakMap 编译缓存、节点执行缓存、失败旁路诊断 | 增加程序来源/时间相关失效键，参数改变不重新编译源码 |
| Gradient | drawContent 内 Canvas 原生两 Stop 渐变，只有末色动画；不是统一可参数化 Capability | 新算法服务 Fill/Generator/Graph，迁移旧渐变外观 |
| Property/Animation | Property<number/Vec2/number[]>，统一动画求值、属性发现与替换，AnimatedField 实时临时预览 | bool/enum 用离散数值，Vec3/stops/texture token 用受约束数组/数字适配，仍走原 Property |
| Inspector/Timeline | 注册 Section；CompositingControls 搜索固定效果、单链增删重排；Timeline 从 layerProperties 发现图参数 | 通用参数 UI，不为每个自定义效果写 React；复杂图只显示摘要和可安全编辑参数 |
| Command/Undo | schema 校验的 CommandSystem + Transaction；graph.replace/property/keyframe/layer.replace；预览不写 Scene | 继续共享命令，包嵌入与实例应用原子提交，用户库不随 Scene Undo 删除 |
| Serialization/Assets | schema 0.7.0，显式旧版迁移，20 MB 工程限制，图节点必须匹配注册类型；图像/模型有独立 Asset | 新格式必须接受旧项目；缺包/未知效果保留并诊断，版本按内容哈希锁定 |
| Registry/UX | EffectRegistry/GraphNodeRegistry/FeatureRegistry/CommandRegistry，九个固定域 | Effects 主入口 Inspector；Fill Appearance；节点 graph.nodeContext；草稿借 Effects/Assistant，不加侧栏 |
| Agent | AgentToolRegistry 只读规划/写命令编译，AgentTransaction 预演并提交；Intelligence 返回 Proposal；真实截图 Observer 已存在 | 增加 Forge 只读草稿生命周期与正式应用命令；搜索原生优先；不能把编译成功当视觉验收 |
| Desktop | 隔离 Electron 预加载桥和受限存储/文件服务；运行时无须 Node 权限 | 声明式解释器不具备文件/网络/系统 API，不增加任意脚本 IPC |

重复与风险：旧 effectDefinitions/EffectRegistry/NodeDefinition 各有参数投影，需统一源头；Fill 目前单独实现。全局注册可使不同工程/版本串扰，不能用全局 last-write-wins 解析自定义包。旧图校验拒绝未知节点，需保留缺失包数据。执行缓存目前仅参数与输入，不含程序随时间变化的上下文。任意 shader 输入必须先经过结构、绑定、复杂度和资源验证；Canvas CPU 运行预算必须可预测。

实施选择：在现有 Canvas 后端增加能力适配器；首批自定义包使用版本化、哈希校验的受控声明式像素表达式，不执行 JS，不宣称支持 WGSL。内置效果通过 Adapter 迁移，程序包与实例分开，包在工程内嵌便于迁移；外来包执行前显式信任。之后的文档与验收以实际代码为准。
