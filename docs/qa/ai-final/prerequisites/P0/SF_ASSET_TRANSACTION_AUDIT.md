# SF 事务、资产及重要边界审计

审计日期：2026-10-14（Asia/Shanghai）。本轮只读取产品源码、运行验证、编写审计材料，没有修改业务代码、历史V2-7报告、Git HEAD/分支/index，没有调用付费模型。以下源码链接指向真实1.0.3工作树，不指向当前旧工作区。现场原始记录见 [SF_AUDIT_SNAPSHOT.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_SNAPSHOT.json)。

现有相关测试：98/98通过，见 [SF_EXISTING_TEST_RESULTS.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_EXISTING_TEST_RESULTS.json)；补充审计断言：11/11通过，见 [SF_AUDIT_REPRO_RESULTS.json](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO_RESULTS.json) 与 [SF_AUDIT_REPRO.test.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an/docs/audit/SF_AUDIT_REPRO.test.ts)。AUD-03～08及AUD-11通过表示成功证明边界或复现缺陷，绝不表示缺陷已修好。测试使用独立工程、模拟文件接口/位图/时序，未读取私人素材或密钥。

## 原子范围

[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:664)先transactionSchema.parse，命令应用到局部project，全部完成后assertProjectState，最后一次发布#project/Undo、清空Redo。失败返回ok:false；没有部分正式Scene写入（AUD-01、commands.test.ts）。DeepFreeze防止外部对象原地修改。它不是磁盘事务、权限网关、图形预览事务或通用异步事务。

[src/agent/transaction.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/transaction.ts:17)把Agent步骤放在sandbox；任一步结果/范围验证失败discard，正式commit合并pending并检查host.getSnapshot()===base。正式Scene失败不留下部分写入（AgentTransaction及V2并发测试）。V1 workspaceChanged在Scene commit后applyWorkspace，genericworkspace命令则先执行redo回调；回调抛错不具备外部状态回滚。AUD-04只使用审计callback复现，未声称现有用户回调已发生这种异常；不能将此原子承诺扩展到UI/文件。[src/core/command-system.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/command-system.ts:706)、[src/agent/transaction.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/agent/transaction.ts:170)。

## 资产文件与Scene

原生图片导入实际上只读取用户文件并注册swayframe-asset URL。[apps/desktop/electron/assets.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/assets.ts:9)的import/register/installProtocol、readImage用同一文件描述符读/验签；没有复制/写入/删除素材文件。[src/desktop/asset-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/asset-service.ts:57)只提交Asset记录与Layer。因此不存在当前导入“磁盘copy随Scene回滚”的完整实现，也没有依据需要引入分布式资产事务。

Web素材dataUrl内嵌Scene；模型mesh也嵌入Scene，临时blob URLs在finally释放。链接source.path、metadata、URL写入JSON，原文件保持外部依赖。Project IO [apps/desktop/electron/files.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/files.ts:14)单独atomicWrite；settings/recovery/export各有自己的文件行为，不能纳入executeTransaction原子范围。未来生成文件尚无对应完整托管生命周期，应先明确临时文件、提交归属和失败清理，不得假设现有Undo可回收物理文件。

## Undo与共享引用

asset.add.inverse=asset.remove，asset.remove只删Project.assets；layer.delete也只删Scene Layer。[src/core/project-schema.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/project-schema.ts:400)检查所有合成中的assetId引用，删除仍有引用的Asset导致整个事务失败。AUD-02在两个图层共享Asset时复现拒绝，删除一个图层和Undo保留另一引用。

Canvas2DRenderer.syncAssets/dispose只关闭解码位图/媒体reader并清理缓存，未删除用户文件。**“Undo误删仍引用原始素材文件”在已追踪路径无需修复**；不能因此声称已存在引用计数磁盘GC。协议resources/FileGrants的应用生命周期累积未见Scene Undo联动，长期重复导入内存/权限集合增长是合理风险，未压力复现。

## 异步工程身份及权限

| 边界 | 结果 / 证据 | 分类 |
|---|---|---|
| importNativeAssets等待导入期间切换Project | 旧导入写入新工程，AUD-07；没有captured revision/project ownership检查。[src/desktop/asset-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/asset-service.ts:57) | 已由测试证实 |
| Web图片/添加既有Asset/relink的await | [src/ui/asset-import.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/ui/asset-import.ts:10)、src/desktop/asset-service.ts.relinkAsset均未提供统一ownership检查；同ID重载/合成切换具体时序未全复现 | 已由源码证实缺少检查；具体后果合理风险但尚未复现 |
| save pending后newProject | AUD-05旧save结果覆盖新工程path，dirty=true；后续保存可能覆盖旧工程文件的最终磁盘后果本轮未执行。[src/desktop/project-service.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/desktop/project-service.ts:10) | 状态污染已由测试证实；磁盘覆盖合理风险但尚未复现 |
| open pending期间GUI提交 | AUD-06GUI编辑被ProjectService.replace覆盖且dirty归零；protect只在await前检查 | 已由测试证实 |
| Agent晚到/GUI并发 | controller订阅取消 + Runtime.checkActive/accept + commit base身份检查。现有late response五种事件及并发事务测试通过 | 已由测试证实防护，无需另建冲突合并系统 |
| 文件授权 | preload不提供任意fs；installIPC限定webContents及mainFrame并解析requestSchema；FileGrants约束IO | AUD-10测试证实调用防护，不等于远程MCP身份授权 |
| Project声明linked路径 | NativeServices.hydrate直接grantRead(source.path)再register，未逐素材询问。AUD-08用虚构非存在路径证明授予，不读取任何私人文件。[apps/desktop/electron/native-services.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/apps/desktop/electron/native-services.ts:26) | 自动授予已由测试证实；恶意外部工程读取本地有效媒体的完整攻击未复现 |

当前hydrate可以理解为“用户打开工程即信任工程的外部链接”，但这不等于可允许模型/远程工具随意声明本地路径。P1前必须明确信任来源与受限资源授权；不要把grantRead/整个NativeServices.dispatch或raw Command暴露成可调用工具。NativeAssets限媒体扩展/格式/大小，不应夸大为任意脚本执行或无限文件读取。

## 保存可用性

saveProject/loadProject总上限20MB；单Asset.dataUrl允许最多14MB，Project.assets最多500。CommandSystem只做schema校验，没有检查完整saveProject的长度。AUD-11两份11MB dataUrl元数据成功提交后，saveProject抛FILE_TOO_LARGE：**可形成合法但无法保存的Scene**。这是core契约复现；测试数据只是syntactically valid base64，不冒充两个真实可解码PNG。Web两份接近限制的真实图片引发同类规模风险是合理推论。模型importModelFiles已经调用saveProject候选预检，参见 [src/importers/model-import.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/importers/model-import.ts:219)；图片/普通命令未统一保证。不能通过只提高上限、静默丢Asset或在Undo删二进制来掩盖。

## 颜色、Alpha、坐标约定

[src/renderers/draw-content.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/renderers/draw-content.ts:11)：核心Color为0..1 RGBA，cssColor转RGB 0..255和独立Alpha，editor fill数组也是[r,g,b,a]。[src/core/compositing-pixels.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/compositing-pixels.ts:2)：Uint8ClampedArray RGBA、straight alpha，source-over后解除预乘，Alpha0输出RGB0；AUD-09半透明红叠不透明蓝得到[128,0,127,255]。代码按当前通道字节值算术，未发现此路径的显式线性光转换/统一ICC管理。不能宣传完整线性色彩/HDR保真，现有普通图层路径不要求本轮重写Renderer。

[src/core/matrix2d.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/matrix2d.ts:39)和drawContent：2D合成像素坐标X右、Y下，局部内容以(-width/2,-height/2)绘制；位置是局部原点映射，anchor以本地偏移参与matrix，正90°旋转将局部(1,0)映射到(0,1)（AUD-09）。3D [src/core/perspective.ts](/Users/aphelion-01/Documents/Codex/2026-10-03/Swayframe_Repairs/1.0.3/src/core/perspective.ts:110)：cameraView变到相机坐标，z<=1裁剪，x/y投影到(width/2,height/2)，screen Y仍同符号；模型轴约定不能默认视为Blender米制/Z-up。预览zoom、outputScale与Scene坐标分离。

## 重复与缺口判定

Web嵌入/native链接是两种资源策略；二者读取/解码入口有重复的组装、时间/尺寸/选择逻辑，最终asset.add/layer.create一致。真实缺口是统一异步归属、可保存性预检与显式结果/错误返回，不是缺少第二Asset Registry。模型导入现有revision guard可供复用。当前未验证托管文件复制、原子跨磁盘回滚、物理引用计数GC；以“缺乏证据”标注，不设计不存在的系统。
