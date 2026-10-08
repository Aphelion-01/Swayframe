# Effect Runtime 性能优化结果

日期：2026-10-09。沿用 V0.3 `declarative-pixel-v1`，未修改用户入口、工程格式、包哈希或 Command/Transaction 规则。

## 改动

旧解释器对每个像素重复遍历源对象、解析参数和计算时间/常量。新 `pixel-program.ts` 在编译时生成固定数字操作码、参数索引和依赖计划；帧常量每帧计算一次，Y 相关表达式每行计算一次，X 相关表达式可按列复用，只有混合坐标和输入像素相关计算留在内循环。只运行最终 RGBA 可达的指令。

保留原算术顺序、Float64 精度、像素中心采样、非有限值回退、除零规则和 Uint8ClampedArray 舍入。列缓存最多8MiB，超限自动使用无列缓存计划；原像素/指令预算及导出错误门禁没有放宽。编译仍按源内容哈希缓存；参数、时间和尺寸只在渲染时绑定。不生成或执行任何 JS 源码，不使用 eval / Function。

## 实测

同一有机纹理包、默认参数、time=0.75、frame=18，每组3次取中位数。原解释器冻结在测试辅助文件中，不进入产品构建。

| 环境 / 尺寸 | 原解释器 | 优化后 | 提速 | 像素 |
| --- | --- | --- | --- | --- |
| Node / 192×108 | 20.12ms | 1.12ms | 18.0× | SHA256一致 |
| Node / 1280×720 | 883.18ms | 45.38ms | 19.5× | SHA256一致 |
| Node / 1920×1080 | 1994.85ms | 97.60ms | 20.4× | SHA256一致 |
| 真实浏览器 / 1920×1080 | 1791.90ms | 95.10ms | 18.8× | 逐像素一致 |

Node数据在完整质量检查结束后独立运行，避免测试进程竞争造成失真。记录见 `outputs/effect-runtime-performance/paired.json`，浏览器记录见 `browser.json`。复查 Node 基准：`node scripts/effect-runtime-performance.mjs /tmp/swayframe-effect-performance.json`。浏览器基准仍使用 `/outputs/effect-engine/benchmark.html` 的现有运行入口。

这些数值仅是本机、有机纹理示例和像素计算耗时，不是全场景帧率承诺。约95ms仍高于30fps所需的33ms，主线程 CPU 执行尚有交互阻塞；本轮没有实现 Worker/GPU、降分辨率预览或4K自定义效果。任意程序尤其像素噪声或 Image Filter 的提速幅度取决于可复用计算比例。

## 验证

- 全部25条指令与旧解释器对照；80个固定种子的混合程序覆盖非有限中间值和不可达代码。
- 逐行、逐列、单像素宽/高、变尺寸、参数重绑定与列缓存预算超限回退保持字节一致。
- 实际 Canvas 的 Fill/Generator/Graph、非零模糊 Undo/Redo、关键帧、保存重载、Preview/PNG Export 和缺失效果阻止导出继续通过。
- 完整回归：130文件、514测试通过。lint、typecheck、Web build、desktop build通过；保留已有大包体积提示。

本轮没有新增用户功能入口，因此无需增加命令、Feature 或永久按钮；既有九域和 canonical home 不变。Scene、用户库、信任和草稿状态均未调整。下一阶段若要稳定实时播放，需要单独处理异步执行与预览调度，不能将本轮提速称为该工作已完成。
