# Transform / Readability 进度

基线：0.7.0 / 1ca1e1e；任务：docs/baseline/TRANSFORM_READABILITY.txt。

## TP-0 审计

Canvas单选缩放调用resizeLayer，围绕相对边/Alt锚点；多选缩放/旋转直接平均position，混用局部/世界空间。Move经Store将世界delta转父坐标，父子联合选区排除重复变换。transform-editing共用动画命令与预览，提交一次Transaction；瞬态预览同步引用避免快速松手漏值。

RenderSnapshot已有世界2D矩阵、投影quad、父级解析和Camera。transform-geometry handles基于层尺寸，未提供统一Selection Bounds；Text真实字形布局与Path几何需补共享bounds适配。保留渲染/动画/TRS模型，通过上下文、resolver和局部值覆盖渐进扩展。仿射变换若需要TRS无法表达的剪切，明确拒绝该次非等比操作，不能静默破坏形状；均匀缩放可精确处理。

工作区设置不进入Scene；Layer Accent新增可选工程metadata，经现有Command持久化。严格TP-0→TP-8，然后VR-0→VR-8，每阶段完整质量门禁。

TP-0门禁PASS，209 tests。TP-1：独立orientation/pivot类型、可扩展Vec3/Basis/Context合同，偏好容错读取与Store状态，切换工程保留习惯，不写Scene。

TP-1～TP-3门禁PASS（209 tests）：类型/工作区偏好→Bounds/Pivot/Basis resolver→共享TransformContext与Move。TP-4～TP-7门禁PASS（215 tests）：多选与支点数学、轴向约束、Canvas/Inspector共同计算与一次事务、自定义支点视觉/拖动。

TP-8门禁PASS（221 tests）：A1～A10覆盖真实组件交互与独立几何断言。补修世界旋转在非等比父级下需要连同Scale补偿提交、取消Custom Pivot显式恢复undefined、轴向切换取消手势。当前二维轴向支点可用；已有三维平面手势保留，三维选择禁用二维新控件，View的屏幕基与可扩展Camera axes3D已定义，不新增三维操控模块。原来的相对边缩放改为明确选择的支点缩放，默认Local+Anchor，Alt仍临时Anchor，Shift等比。

## VR-0 审计

Timeline目前以每层一个container包裹heading、group与Property，未计算实际Visible Row Index；左侧sticky property-name有独立背景，直接nth-child会错位。静态row DOM已有memo，播放头CSS变量独立更新。需先建立统一行序列描述（Layer/Group/Property）再将row编号和共享背景作用到整行与sticky区域，不改变26px属性行或关键帧时间坐标。

Layer Panel、Timeline没有持久色标；Layer可增可选ui元数据，但严格Schema需要版本升级与0.5迁移。统一6个低饱和accent和None；默认新层循环分配。修改颜色复用layer.replace Command，选择仍全局selection色优先。颜色不是Property Type，不给效果节点分配Layer颜色。

VR-0门禁PASS（220 tests）；TP-8补充键盘轴向与取消回归后221 tests PASS。VR-1：新增中性行底色与六个低饱和色标tokens，不按属性类型染色。

VR-1/VR-2门禁PASS（221/222 tests）：统一tokens与真实Visible Row Index；折叠、筛选、分组都重排，补修图片异步解码后旧控制柄重复显示。VR-3：左右共用整行底色，selection高于hover高于条纹，属性缩进和动画状态强化，保留26px行密度。

VR-3门禁PASS（222 tests）。VR-4：Layer.ui.accentColorId为可选身份元数据，新增层循环分配六种色标，Schema升级0.6.0，旧0.1～0.5迁移时分配默认色标；既有显式None保持，变换工作区偏好不入工程。

VR-4门禁PASS（222 tests）：旧版本测试使用真正的旧格式（不含新ui），严格迁移通过。VR-5：Layer Panel与Timeline使用同一身份组件，3px色条只标识图层，不替换selection；色标排除出Canvas视觉失效和嵌套Precomp源像素缓存，未来未知ui字段仍失效。

VR-5门禁PASS（222 tests）。VR-6：图层菜单增加紧凑颜色子菜单（None+六种），当前颜色有勾选状态，键盘导航/返回/Esc可用；Timeline图层标题也复用同一菜单，修改通过layer.replace一次Transaction支持Undo。

VR-6/VR-7门禁PASS（222/227 tests）。新增严格迁移、None/六色持久化、实际菜单/Undo/两面板一致、100属性DOM稳定性、嵌套Precomp缓存和未知字段回归；菜单装饰箭头/勾选从可访问名称排除。VR-8：真实界面与桌面验收、发布0.8.0、补齐曲线/Image/Precomp Bounds独立断言与架构记录。

VR-8最终门禁PASS（227 tests / 81 files）：真实界面发现并修复旧Timeline 240px高度限制；应用版本唯一来源src/desktop/product.ts更新0.8.0，生成元数据与安装包一致。真实1280编辑交互、1920布局容器、100实际属性行、选中/hover/条纹颜色差异、原生保存→退出→最终包重开→另存JSON一致、旧工程PNG逐字节一致均验证。原生自定义支点指针自动化未可靠完成拖动，未作为通过证据；指针拖动/Esc由组件测试覆盖，真实UI通过键盘设置Custom Pivot并旋转验证。详见总验收记录。
