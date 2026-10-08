# Swayframe 0.9.16：摄像机、模型与空间运动路径验收

本轮按用户的五项要求实现，并按后续授权上传 GitHub。原始范围见 `docs/baseline/SPATIAL_CAMERA_MODEL.txt`。

| 要求 | 实现与入口 | 验收 |
| --- | --- | --- |
| 双指左右旋转反向 | 仅反转三维观察视图的触控板水平环绕方向，保留 Shift 平移、缩放及鼠标行为 | 手势映射测试通过 |
| 摄像机位置与拍摄范围 | 三维视图显示摄像机及“拍摄中/未生效”；选中摄像机后在属性面板切换拍摄范围，显示视锥与焦平面 | 浏览器双视图检查及父子级摄像机姿态测试通过 |
| 景深、光圈、曝光 | 摄像机属性提供景深开关、焦点距离、光圈 f/、曝光 EV；参数可动画、撤销、保存；合成预览应用效果，三维观察视图保持清晰 | 实际界面调整光圈与曝光；数值、迁移与渲染测试通过 |
| 三维模型导入 | 项目面板“导入三维模型…”为主入口，文件菜单为次入口；支持 GLB/glTF、FBX、OBJ/MTL、STL、PLY、DAE、3DS，可批选依赖文件或拖入项目面板 | 八类格式解析、实际 OBJ 界面导入、保存重开、撤销重做与失败原子性测试通过 |
| 运动路径与终点 | 选中有位置关键帧的图层，在合成和三维视图显示路径、终点轮廓及 Bézier 控制点；支持 2D/3D/摄像机位置、父子级转换、拖动和键盘微调 | 双视图编辑、松开提交、取消、撤销、保存及透视投影测试通过 |

## 架构与入口复核

所有工程修改通过共享 Command System / Transaction。导入先完整解析和校验，再以一个 Transaction 添加资源及图层；路径拖动仅在 UI 中预览，松开时一次提交。显示开关、观察视角等临时状态不进入 Scene，Intelligence 仍只输出 Proposal。

Feature Placement Review：模型导入归属 PROJECT / 项目面板，拍摄范围归属 CANVAS / 摄像机属性 Section，运动路径归属 MOTION / 变换属性 Section。复用现有菜单、属性面板和直接操控工具；没有增加常驻全局工具栏按钮。更新 FEATURE_INVENTORY.md、FEATURE_LOCATION_MATRIX.md 与 typed registry；登记与位置验证测试通过。

UX heuristic check：摄像机状态与视锥可见；双视图采用同一套关键帧和撤销行为；控制点拥有 24px 命中区及键盘操作；终点标记增加底板避免文字重叠；导入失败保留原工程并报告原因；格式限制在导入及属性界面说明。1280×900、1440×900、1920×900、2560×1440 四档检查均无横向溢出。这是本轮实际检查，不代表独立用户研究。

## 验证结果

- lint、typecheck：通过。
- 全量测试：116 个测试文件，456 项测试通过。
- Web 与 Electron 构建：通过。
- macOS arm64 DMG、Windows x64 EXE：打包通过；两平台 app.asar 的 16 个前端/桌面构建文件与最终构建逐字节一致，版本均为 0.9.16。
- 桌面 CSP 增加本地 `data:` 数据读取以支持 glTF 内嵌资源；测试确认不开放任意远程连接或不安全脚本执行。
- 浏览器实际执行 OBJ 导入、路径微调/撤销、摄像机范围切换、景深/光圈/曝光调整。截图、测试日志、打包核对和测试工程位于 `outputs/spatial-camera-model/`。
- 未进行 Windows 原生运行验收或完整安装流程验收；安装包未签名。

## 明确边界

模型导入为静态三角几何与材质颜色，不导入纹理、骨骼或动画；PLY 需要面数据。原生 BLEND/C4D/MAX 工程需先导出上述交换格式。未配置 Draco/Meshopt 解码器的压缩 glTF 不支持。单模型上限 20,000 个三角面、导入文件批次上限 100 MB，工程沿用 20 MB 保存限制；只解析用户选定的本地依赖及内嵌数据，不联网抓取模型资源。

模型采用软件投影与面排序，尚不是完整 GPU 深度缓冲渲染器，复杂穿插与近裁剪不等同于专业三维渲染器。景深按图层深度近似模糊，曝光作用于合成预览，不是物理散景模拟。运动终点轮廓采用当前对象姿态和当前父级变换下的最终位置，不代表所有属性在最终帧的完整快照。

## 实现参考

- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[FBXLoader](https://threejs.org/docs/pages/FBXLoader.html)、[OBJLoader](https://threejs.org/docs/pages/OBJLoader.html)、[STLLoader](https://threejs.org/docs/pages/STLLoader.html)、[ColladaLoader](https://threejs.org/docs/pages/ColladaLoader.html)。
- FBX 测试样本来自 Three.js 官方仓库；来源与许可见 `tests/fixtures/models/README.md`。
- GitHub 发布目标：[Swayframe v0.9.16](https://github.com/Aphelion-01/Swayframe/releases/tag/v0.9.16)。上传成功与资产校验另外记录于本机 `outputs/spatial-camera-model/github-verification.json`。
