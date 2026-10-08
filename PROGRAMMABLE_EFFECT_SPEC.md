# Programmable Effect Package v1

可导入、导出自包含 `.sfe.json`。字段包括 `format: swayframe.effect.v1`、id、语义版本、name、description、category、parameters、inputs、outputs、`runtime: declarative-pixel-v1`、program、dependencies、contentHash。第一代 dependencies 必须为空；不访问外部资源。

参数 Schema 支持 float、integer、boolean、color、vec2、vec3、enum、gradientStops，均绑定标准动画 Property。Color 为 0–1 RGBA，Vec2 为 `{x,y}`，Vec3 为三元素数组。gradientStops 为 `[position,r,g,b,a,...]`，2–32个有序色标。统一协议另预留 texture 类型；本运行时仅支持 Filter 的图像输入端口，不宣称支持外部多纹理参数。

Generator 无输入；Filter 一个 `in:Image`；输出一个 `out:Image`。程序为 instructions 与四个输出索引 rgba。每条指令的 args 只能引用前面的指令。常量用 value；参数用 parameter 和可选 component；示例见 `effect-examples.ts` 与 `outputs/effect-engine/organic-texture.sfe.json`。

支持 constant、parameter、u/v、time/frame、width/height/aspect、input、add/subtract/multiply/divide、sin/cos/abs/sqrt/floor、min/max/clamp/mix/smoothstep、noise。input 读取同一像素的指定 RGBA 通道。noise 为确定性数值噪声，随机效果必须声明整数 seed。除零及非有限中间值回退为0；最终 RGBA 裁剪为0–1。

限制：包256KB，参数32个，指令256条，无循环，单次最多4,194,304像素、128,000,000条标量指令执行。编译缓存64包；用户库最多100包、4MB。资源超限返回明确错误；需要更大分辨率时简化程序或降低合成尺寸。当前没有 GPU/Worker 加速，因此复杂纹理不能保证拖动和播放的实时帧率。

哈希为规范化 JSON 的标准 SHA256，排除 contentHash 自身。修改程序、元数据或参数默认值后需重新计算。导入已有包会校验哈希；编辑草稿时可删除旧 contentHash，由系统封装生成新哈希。同一 ID/版本的不同内容不能覆盖用户库，必须提升版本。

草稿只有完成验证、编译、真实192×108像素预览和检查后才可申请应用。Filter 草稿使用明确标注的固定棋盘测试图；工程中的实际输入仍由 Graph 连接决定。应用与保存到正式库分离。编译通过和像素统计不代表符合用户的视觉意图。
