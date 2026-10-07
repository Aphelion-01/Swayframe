# Timeline / Keyframe Editing 审计

基线 0.9.8（6dded46），执行 V02_TIMELINE_INTERACTION.txt。

## Working

统一秒时间、Scene Property/Keyframe、CommandSystem、移动/复制/删除/曲线命令；关键帧窗口级 Pointer 捕获并采样释放坐标；多帧共享 delta/clamp；播放按 performance 时间差；固定行高、共用纵向滚动；已有时间条 trim/move、Graph/Motion Curve 和工作区高度调整。GUI/Agent共用命令。

## Partial

目前只有“变换与动画属性”一个组，非变换静态属性被过滤；选中层自动展开，没有默认折叠；关键帧选择会覆盖已有图层选区；播放头行 DOM 有缓存，但 Timeline 仍订阅全部 EditorView。复制只按同名属性路由，缺少明确目标 Property。图层名称无 Timeline 自身编辑入口。

## Broken

缩放使用硬编码220/310px，不能支持可调树列宽；时间码使用floor导致边界帧显示不一致；吸附到非整帧播放头可令关键帧离开帧网格；关键帧拖动不冻结refs，期间选区变化可能移动另一组。多选包含锁定层时的编辑保护不足。

## Missing

属性搜索、Selected Properties 筛选、真正分组/折叠、时间轴多层排序与插入提示、可调树列、动态主次帧刻度、明确Property目标跨属性粘贴、Time Area上下文菜单、Fit Composition入口、Shift Wheel平移、统一Timeline Pointer载荷。

## Interaction conflicts

Time Area空白点击既跳时间又作为框选起点；Shift关键帧点击移除后仍可能开始拖动剩余选区。低频关键帧动作和动画缓动永久按钮仍占据footer。曲线面板与Graph可能同时出现；键盘过滤部分在global生效。图层上下文复制可能因旧frames选区误复制关键帧。

## Performance issues

scrub期间逐次筛选全部关键帧以判定当前帧；keyframe selection查询大量some，200次pointermove会重建可见row JSX。应先测100层/500/1000帧成本，保留小工程简单结构，不预先引入虚拟化。

## Architecture risks

多个独立drag refs，trim由子组件管理而keyframe/ruler/marquee各自管理，需要互斥协调；UI展开、列宽、搜索只属于workspace/session，不能写Scene。禁止引入Graph专用动画数据、永久Scene预览、第二套时间计算。

## 本轮关闭状态

P0 数据风险（冻结refs、帧网格、错误属性目标、原子历史）已修复并测试。P1 结构/交互问题（三层树、默认折叠、冻结列、缩放、筛选、曲线互斥、排序与选区同步）已实现。P2 细节（形态、tooltip、重命名、取消、菜单与快捷键焦点）已验收。性能先测100层/500与1000帧，再采用memo/CSS delta/时间索引，未虚拟化。最终证据和明确未验收范围以TIMELINE_UX_RESULT.md为准；此审计上文保留原始基线问题，不代表它们仍存在。
