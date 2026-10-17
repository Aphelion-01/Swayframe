# Swayframe AI Security Final Review

日期：2026-10-16。**本轮限定本机路径未发现工程损坏或未授权写入；不等于全面安全认证。** 无新增业务代码、协议、权限或付费调用。详细证据基线和数量见SF_AI_FINAL_ACCEPTANCE.md。

## 威胁模型

外部客户端参数、manifest、素材路径、图层名称/文本均不可信。用户在本机可信Renderer主动启用MCP，给单个可信客户端本次有限权限。OS管理员/同用户调试器、已攻陷Renderer、远程转发、本机持续DoS不在已验证强隔离承诺内。

## 安全矩阵

| 边界 | 本轮实际证据 | 结果与分类 |
|---|---|---|
| 路径逃逸 / 非法manifest | import/runs/verified读取C-path的`../`及损坏包；import-ui真实非法JSON/缺图；全量中layerpack.test.ts覆盖绝对/URL/反斜杠/百分号/符号链接 | PASS：源码+真实Electron及临时FS单元；不把单元nativeImage替身当真实解码 |
| 超大图片 | 原生P3 Reader读取真实9000×1 RGBA PNG，返回`Layer Package：PNG 像素数超限`，完整Scene/Undo/Redo及保存保持；verified/F-actual-oversized-image | PASS：真实Electron；其他CRC/解压炸弹/总像素上限另由单元和源码覆盖 |
| 未授权MCP | mcp/current默认off、错token、只读写/导入拒绝、未批准/private/etc目录拒绝 | PASS：真实SDK/TCP和Scene比对 |
| 参数 / 已删除图层 | 非法property/`__proto__`/未知字段/随机UUID/删除目标返回原生结构化错误 | PASS：真实协议及全量回归，非任意JSON patch |
| 重复请求 | 相同requestId重复属性写；导入pending重复ID只首个提交 | PASS：REPLAY_FORBIDDEN，Undo恢复原Scene，不静默重复 |
| 旧工程/旧revision | 查询后GUI修改、同ID重载、切工程及旧导入晚到 | PASS：CONTEXT_STALE/STALE_BASE、授权撤销；拒绝旧目标，不用当前Selection替换 |
| 断开/取消/关闭 | 原native IO已完成但返回暂停，Client abort/close、真BrowserWindow.close后放行 | PASS：不发布半Scene；独立Node观察进程code0、listener释放、磁盘文件不变 |
| 失败回滚 | 导入事务末尾无效命令、坏第二PNG、真实PNG合并后超过20MB、Agent草稿无效opacity | PASS：正式Scene/历史不污染；内存事务不冒充跨文件事务 |
| 共享素材/保存重开 | 重复包复用Asset，Undo保留旧引用；删除自有源包后独立进程重开仍渲染 | PASS：嵌入持久化，未物理删除共享用户文件 |
| 临时文件清理 | separation/current中真实生成stage的写失败ENOSPC注入和取消；原子保存沿用files.ts | 已测生成stage清理PASS；不是实机磁盘真的写满或系统强杀测试 |
| 付费模型和外发 | QA主进程拒绝ai.chat/models/test；Agent仅离线Provider，P7本地Vision；各报告网络/模型计数0 | 本轮付费调用0；不声称监控整个OS或所有Node网络活动 |

## 实际源码边界

- `apps/desktop/electron/mcp-bridge.ts::installMCPBridge`：未启用不监听，仅127.0.0.1、临时随机token、timingSafeEqual、一次会话、候选/消息上限。`trusted`限定本窗口mainFrame；窗口生命周期保护已继承P7修复，本轮未改。
- `apps/desktop/electron/mcp-server.ts` / `src/mcp/contract.ts`：七工具有限映射；SDK处理stdio。无shell/eval/run_script/任意fs写入/原始Command工具。图层名及素材内容仅数据，不解释成指令。
- `src/mcp/renderer-host.ts::attachMCPHost`：先查用户本次read/edit/import权限与唯一目录，切文档撤销，取消映射到既有操作。
- `src/desktop/editor-operations.ts::EditorOperations`：项目身份/快照revision、显式layerId、原生属性路径、256个请求ID限制，source标签不是权限。底层仍是原Command/Transaction。
- `apps/desktop/electron/layerpack.ts::readLayerPack`：realpath包含、逐组件拒绝symlink、O_NOFOLLOW/描述符状态复核、有界读、PNG CRC/解压/尺寸和严格manifest。恶意并发替换的所有竞态不在本轮证明范围。
- `src/importers/layerpack-import.ts::importLayerPack`：内存准备→快照/signal核对→单笔可保存性事务；无临时PNG路径永久引用。`CommandSystem.executeTransaction`失败不发布局部project/历史；不把文件写入纳入Scene原子承诺。
- `apps/desktop/electron/image-layers.ts::LocalImageLayers.generate`：固定execFile helper、受控快照、限额、stage→rename、失败只清理自己stage；已完成导出的用户包不因随后取消或Undo而删除。
- `src/ui/core-v2-controller.ts` / `src/agent/transaction.ts`：观察正式Scene/选区并取消，commit再比base。真实GUI交错与失败草稿已离线Electron验证，无新的自然语言Live质量证明。

## 无需修复 / 尚未验证 / 发布阻断

**本轮无需产品修复：** 已测路径无工程损坏、资产丢失或权限绕过；原Schema/原子事务/Undo保持，未为通过测试降低语义。首次两处失败为本轮QA构建或过期文字选择器，旧FAIL保留，不当作产品修复。

**限制而非虚构保证：** 已提交后断开可能结果未知，不自动补偿Undo；需查询状态，不能重放旧请求。256次去重表不跨进程永久存在。本机bearer可能被同用户恶意程序读取，loopback非TLS不能对外转发。普通工程hydrate的外链信任政策沿用旧实现，本轮严格PNG包只产生嵌入资产，不把该入口等同于任意外来工程安全。

**NOT VERIFIED：** Windows实机/ACL、全部并发文件替换时序、全OS用户互攻、Renderer崩溃/kill -9、物理磁盘满、持续压力、所有MCP Host和所有图片类型。旧P6依赖audit记录8 moderate/1 high，涉及既有打包/下载工具链；本轮未刷新漏洞数据库，不宣称依赖无漏洞，也未执行未经复现的audit fix。候选使用本地缓存构建；正式签名/发布工具链需独立复核。

**仍阻断对应发布：** Agent V2新Live质量缺证；自动分层复杂边/遮挡质量未达通用要求。未发现本轮范围内新的严重工程损坏缺陷，不能据此宣布所有AI模块可正式发布。V1默认、MCP默认off、不开放任意代码；任何后续复现的工程污染/素材丢失/未授权写入都须立即撤销对应GO。
