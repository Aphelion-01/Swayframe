# AI2Comp V0 导入架构

## 基线与复用

独立分支 `codex/ai2comp-layerpack-v0`，从 `8479ec3` 开始，包含 P1 已修复的异步归属和可保存性保护。原 dirty 工作区、冻结1.0.3、历史V2-7报告、Agent代码均不改。

已读 P0 五份审计及 P1 三份验收报告。P0发现的旧链接导入竞态/20MB候选缺口已由P1的9cf8ca1修复；不以原冻结版本直接开发。P0的跨磁盘事务/物理GC/任意外部路径授权不能假定存在。采用既有内嵌Asset策略，而不是扩展链接策略或自建资源库。

## 完整路径

1. 现有 `application-menu-seed` → `FeatureRegistry` 的 PROJECT / F4 / typed `menu.file` → `buildEditorActions` 绑定 `import-layerpack`。
2. `src/importers/layerpack-import.ts::importLayerPack` 捕获真实Project快照、原始上下文合成、可选目标ID、请求ID及AbortController。
3. 复用 `desktopService.api.dialog.openFolder`，由现有 preload → `installIPC` sender/mainFrame + requestSchema → `NativeServices` 处理目录授权。
4. 新的窄IPC `assets.layerpack(path,requestId)` 仅返回已准备PNG；不能执行Scene命令。`NativeServices` 必须对所选根调用 `FileGrants.requireRead`，其 `readLayerPack()` 只能访问扫描并验证的包内文件。
5. `apps/desktop/electron/layerpack.ts::readLayerPack` 扫描限制/严格manifest/路径/PNG CRC与解压限制/nativeImage真实解码，生成内存 `PreparedLayerPack`。不新增用户文件读权限、不注册路径协议URL、不写复制文件。
6. renderer 再 `parseLayerPackManifest`，复用 `assetImageBlob` + createImageBitmap 逐图解码/比对；bitmap在finally关闭。内嵌Asset、原生createLayer/createComposition与Commands均仅在局部变量暂存。
7. 原 `assertAssetImportCurrent` + 请求归属 + signal检查。仅一次 `store.run` → `transaction` → `CommandSystem.executeTransaction`，真实schema及saveProject候选大小校验在发布前完成。
8. 默认命令为多个 `asset.add` + 一个含完整layers的 `composition.add` + `project.activate`；指定已有目标合成时必须尺寸一致，使用原 `layer.create` 批量提交。没有另一套提交系统。指定非活动合成时保留当前活动合成及选择，不将其他合成的图层UUID塞进当前选择。
9. Undo按原逆命令一笔撤销，Redo恢复相同UUID/资产。保存使用原 ProjectService → preload/IPC → writeProject/atomicWrite → saveProject。重开用原readProject/hydrate/loadProject；内嵌资产没有source.path，无须再次读取原包。
10. Renderer仍是 `createRenderSnapshot` → `Canvas2DRenderer.syncAssets/render` → `drawContent` / 原Graph。映射和颜色约定见manifest文档。

## 生命周期与一致性

- 同一Store最多一个活跃导入token，第二次请求取消并替代第一次；旧结果不能提交或覆盖新状态提示。
- NativeServices另保留有限的运行中读取控制器，同一窗口新读取取消旧读取，requestId重复拒绝；完成/失败finally移除。`assets.layerpack.cancel`只取消对应任务，无任意文件或Scene写接口。
- 目录选择、原生读取、renderer解码后与正式提交前均检查捕获的Project对象身份；切工程、同ID重载、删合成、任何正式编辑或激活另一合成都使旧结果失效。不自动合并旧快照。
- 目标删除拒绝；UI选择/视口变化不构造第二Scene。取消与导入进度状态不序列化。
- 正式Scene不保留“导入中”半状态。单次同步Transaction是唯一发布点；任一命令失败或总工程不可保存都不发布Scene/Undo。

## staging / commit / rollback

这是**内存 staging → 原生Scene事务 commit → 失败释放内存**，不是跨文件系统事务。源包只读，文件复制次数0；部分读取/编码成功的Buffer/dataUrl是暂存数据，失败后不进入Scene、没有待清理磁盘素材。PNG嵌入正式Project后由原有原子工程保存持久化。

工程保存仍是独立文件IO，不能假称Scene Transaction能回滚磁盘；磁盘写失败保留当前完整Scene与dirty状态供重试，原atomicWrite清理临时文件。无需新跨磁盘回滚系统或GC。

## 权限与安全边界

manifest 不接受UUID、Command、脚本、效果、链接资产路径等额外字段。路径层在主进程执行realpath包含检查、逐组件lstat拒绝链接、O_NOFOLLOW（平台支持时）、同一描述符stat dev/ino/size/mtime检查和有界读；外部目录授权不会由模型或manifest自动授予。

已有普通工程hydrate的外链信任政策不在本轮改写；本导入始终生成无source的内嵌PNG，因此不进入该外链路径。没有对远程调用、恶意并发文件系统操作的所有竞态或任意插件安全作额外保证；测试覆盖普通文件/目录符号链接逃逸和当前生命周期。

## Feature Placement / UX检查

已读并遵守 DESIGN.md：对象Asset/Composition，任务Create，频率F4，上下文Composition，域PROJECT，canonical menu.file。复用现有菜单、命令搜索、状态栏和原生属性；未加永久Toolbar或Shell按钮。FeatureDefinition无callback，业务只在原CommandRegistry绑定。取消为F5 menu.file操作，仅pending时启用，Web不开放导入。

FEATURE_INVENTORY.md / FEATURE_LOCATION_MATRIX.md 已登记；现有feature-registry验证通过。真实菜单入口与禁用取消可见，截图/布局边界见UI证据。内部heuristic：名称明确、状态可见、失败原因保留、可取消/单笔Undo、位置一致、无伪百分比；不等同真人可用性研究。
