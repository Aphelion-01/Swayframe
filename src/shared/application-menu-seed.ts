// Data only: shared by the renderer menus and Electron, with no DOM/React imports.
export const applicationMenus = [
  {
    label: '文件',
    items: [
      ['new', '新建工程', 'CommandOrControl+N'],
      ['open', '打开工程', 'CommandOrControl+O'],
      ['save', '保存工程', 'CommandOrControl+S'],
      ['save-as', '工程另存为', 'CommandOrControl+Shift+S'],
      ['new-composition', '新建合成'],
      ['composition-settings', '合成设置'],
      ['import', '导入图片到素材库'],
      ['export', '导出'],
      ['settings', '设置 · AI'],
    ],
  },
  {
    label: '编辑',
    items: [
      ['undo', '撤销', 'CommandOrControl+Z'],
      ['redo', '重做', 'CommandOrControl+Shift+Z'],
      ['cut', '剪切', 'CommandOrControl+X'],
      ['copy', '复制', 'CommandOrControl+C'],
      ['paste', '粘贴', 'CommandOrControl+V'],
      ['duplicate', '创建副本', 'CommandOrControl+D'],
      ['delete', '删除选中'],
      ['select-all', '全选', 'CommandOrControl+A'],
    ],
  },
  {
    label: '图层',
    items: [
      ['create-object', '创建对象'],
      ['rename', '重命名'],
      ['precompose', '选中图层预合成'],
      ['parent-null', '创建父级空对象'],
      ['parent-select', '设置父子级'],
      ['toggle-3d', '切换三维图层'],
      ['align', '对齐与分布'],
    ],
  },
  {
    label: '动画',
    items: [
      ['keyframe', '记录选中属性关键帧'],
      ['interpolation', '关键帧插值与缓动'],
      ['graph', '打开曲线编辑器', 'Shift+F3'],
      ['motion-curve', '曲线编辑器：缓动'],
      ['previous-key', '上一个关键帧'],
      ['next-key', '下一个关键帧'],
    ],
  },
  {
    label: '视图',
    items: [
      ['fit', '适合窗口', 'CommandOrControl+0'],
      ['actual-size', '100% 实际尺寸', 'CommandOrControl+1'],
      ['zoom-in', '放大', 'CommandOrControl+='],
      ['zoom-out', '缩小', 'CommandOrControl+-'],
    ],
  },
  {
    label: '窗口',
    items: [
      ['show-project', '项目与素材'],
      ['show-layers', '图层与层级'],
      ['assistant', '创作助手'],
      ['toggle-right', '切换属性面板'],
      ['timeline', '打开时间轴'],
      ['compositing', '打开合成节点'],
      ['toggle-left', '切换左面板'],
      ['toggle-bottom', '切换底部工作区'],
      ['reset-workspace', '恢复默认工作区'],
    ],
  },
  {
    label: '帮助',
    items: [
      ['help', '操作指引'],
      ['shortcuts', '快捷键'],
      ['palette', '搜索命令', 'CommandOrControl+K'],
      ['about', '关于 Swayframe'],
    ],
  },
] as const;
export type ApplicationActionId =
  (typeof applicationMenus)[number]['items'][number][0];
