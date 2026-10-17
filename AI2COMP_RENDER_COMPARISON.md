# AI2Comp V0 真实渲染比较

输出使用生产 `createRenderSnapshot` 与 `Canvas2DRenderer.syncAssets/prepareMedia/render`，不是测试自建Renderer，不以“没有抛错”为PASS。关闭编辑手柄、outputScale=1、transparentBackground=true。原Renderer源码未修改。

## 固定样例

64×48 sRGB，背景蓝色矩形bounds=(4,4,56,40)，主体红色bounds=(8,9,24,18)，前景绿色bounds=(20,18,16,12)。主体/前景内部Alpha128，边缘Alpha64，外部Alpha0；背景内部Alpha255。A将三张图分别扩展到完整64×48透明画布；B为三张独立裁切PNG。同一文件生成配方在 `work/ai2comp-qa/fixtures.mjs`，不是对当前渲染结果截图生成参考。

layers 顺序 Background → Subject → Foreground，从下到上。source-over 的独立8-bit字节计算生成 expected.png；Renderer没有改成通过参考的专用算法。

## 像素断言

| 画布坐标 | 含义 | 期望RGBA |
|---|---|---|
| (0,0)、(3,3)、(63,47) | 透明边界/画布空白 | 0,0,0,0 |
| (4,4) | 蓝背景起点 | 0,0,255,255 |
| (8,10) | 红主体Alpha64边缘叠蓝色 | 64,0,191,255 |
| (10,10) | 红主体Alpha128叠蓝色 | 128,0,127,255 |
| (24,20) | 绿Alpha128叠红Alpha128再叠蓝 | 64,128,63,255 |
| (34,20) | 主体外、绿叠蓝 | 0,128,127,255 |

容差每通道2来自8-bit Alpha量化和Canvas舍入，未按实际差异放宽。全3072像素/12288通道均比较，实际 **maxChannelDelta=0 / channelsOverTolerance=0**。A/B原生渲染逐通道完全相同。

E-opacity将主体manifest.opacity设0.5，其(10,10)约(64,0,191,255)；原生属性再改为0后变为(0,0,255,255)。证明图层opacity独立于PNG Alpha，而非写进图像。

## 编辑和重开

- 每一层独立移动，非目标层完整对象比对不变；可改opacity、添加两个位置关键帧并验证0.5秒插值；每步Undo恢复序列化Scene。
- 实际动画PNG animated-0 / animated-1不同，subject位置按关键帧改变；不只验证Scene中存在关键帧。
- 保存后删除QA源A包，关闭/打开及第二进程重开，reloaded / reopened均通过同一明确像素断言。
- 帧记录真实ImageData.colorSpace=`srgb`。Canvas读回RGBA为straight；Alpha0 RGB归零。没有线性/HDR、ICC转换、任意格式或跨Windows字节一致性声明。

## 产物

`docs/qa/ai2comp/runs/final-i/` 包含：a-full.png、b-cropped.png、animated-0.png、animated-1.png、opacity-half.png、opacity-zero.png、existing-composition.png、reloaded.png、reopened.png、frames.json、render-comparison.json。

final-c/d/e为同一生产实现的前置17项完整运行，final-i为增加opacity/已有合成的扩展集合。PNG与报告SHA256见evidence-manifest.json；UI菜单截图不参与最终成片像素比较。QA页面独立文件URL未提供正式公共品牌URL，截图中的旧品牌资源占位不代表正式安装包资源缺失；原生入口实际菜单和控件有真实验证。

运行：`node work/ai2comp-qa/run.mjs <未使用的名称>`；该脚本会启动真实Electron，必须在已解锁桌面会话运行。
