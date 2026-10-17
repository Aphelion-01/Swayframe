# AI2Comp V0.1 — 模型及素材许可核对

日期：2026-10-16。技术核对，不是商用法律认证。

## 实际使用

使用系统公共 [Vision foreground-instance API](https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest)，不下载、不提取、不打包Apple模型权重。Mac仅分发SF自写Swift helper并链接系统框架；Windows不带helper。不能称其为MIT/Apache开源模型，也不能据此分发权重。

已核对 [Xcode and Apple SDKs Agreement](https://www.apple.com/legal/sla/docs/xcode.pdf)：2.2A允许在符合条件的Apple电脑上开发测试；2.2C限制Apple模型访问并禁止使用输出训练/微调/改进其他AI模型。本实现走已文档化Vision公共接口，不访问私有缓存或导出权重。2.4区分macOS非AppStore分发；仍须遵守适用条款。以上不等于已获商店审核/签名/公证。

输入照片使用者必须有相应权利。本轮只用scikit-image官方公开摄影样例：chelsea/coffee为CC0，astronaut来自NASA公共领域数据库，详见 [官方数据许可](https://scikit-image.org/docs/0.20.x/api/skimage.data.html) 及 `docs/qa/segmentation/inputs/ATTRIBUTION.md`。输入许可与模型输出约束分开，不把派生mask一概重新声明为CC0。

## 未使用方案

本机未就绪的PyTorch/ONNX/rembg后端未安装或分发，不虚构权重许可。未使用Inpainting模型；OpenCV也未安装/运行。不把“某仓库代码开源”解释为其中所有模型权重可商用。跨平台替代后端和修补模型必须另行核对权重、训练数据与使用限制后才能加入。

本轮没有付费API，无需调用预算；没有照片发送给第三方。自动验收拦截并统计网络/AI调用（0）。该计数覆盖应用测试会话，不作为整个OS所有系统网络行为的证明。
