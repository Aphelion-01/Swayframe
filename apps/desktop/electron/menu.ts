import { app, Menu } from 'electron';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import type {
  DesktopAction,
  RecentProject,
} from '../../../src/desktop/contracts';
import { ProductMetadata } from '../../../src/desktop/product';
export function installMenu(
  window: BrowserWindow,
  recents: RecentProject[] = [],
) {
  const item = (
    label: string,
    action: DesktopAction,
    accelerator?: string,
  ): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => window.webContents.send('swayframe:action', action),
  });
  const menus: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: ProductMetadata.name,
            submenu: [
              item(`关于 ${ProductMetadata.name}`, 'about'),
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              {
                label: '退出',
                accelerator: 'Command+Q',
                click: () => window.close(),
              },
            ],
          },
        ]
      : []),
    {
      label: '文件',
      submenu: [
        item('新建工程', 'new', 'CommandOrControl+N'),
        item('打开工程…', 'open', 'CommandOrControl+O'),
        item('保存', 'save', 'CommandOrControl+S'),
        item('另存为…', 'save-as', 'CommandOrControl+Shift+S'),
        { type: 'separator' },
        item('导入图片…', 'import'),
        item('导出…', 'export'),
        {
          label: '最近工程',
          submenu: recents.length
            ? recents.map((r) => ({
                label: r.displayName + (r.missing ? '（文件失联）' : ''),
                click: () =>
                  window.webContents.send('swayframe:action', 'open', r.path),
              }))
            : [{ label: '暂无最近工程', enabled: false }],
        },
        { type: 'separator' },
        item('关闭工程', 'close-project'),
        {
          label: '关闭窗口',
          accelerator: 'CommandOrControl+W',
          click: () => window.close(),
        },
        { label: '退出', click: () => window.close() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        item('撤销', 'undo', 'CommandOrControl+Z'),
        item('重做', 'redo', 'CommandOrControl+Shift+Z'),
        { type: 'separator' },
        item('剪切', 'cut', 'CommandOrControl+X'),
        item('复制', 'copy', 'CommandOrControl+C'),
        item('粘贴', 'paste', 'CommandOrControl+V'),
        item('创建副本', 'duplicate', 'CommandOrControl+D'),
        item('删除', 'delete'),
        item('全选', 'select-all', 'CommandOrControl+A'),
      ],
    },
    {
      label: '视图',
      submenu: [
        item('放大', 'zoom-in', 'CommandOrControl+='),
        item('缩小', 'zoom-out', 'CommandOrControl+-'),
        item('适合窗口', 'fit'),
        item('实际大小', 'actual-size'),
        { type: 'separator' },
        item('切换左面板', 'toggle-left'),
        item('切换属性面板', 'toggle-right'),
        item('切换时间轴', 'toggle-bottom'),
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '动画',
      submenu: [
        item('添加位置关键帧', 'keyframe'),
        item('打开曲线编辑器', 'graph'),
        item('打开动效曲线', 'motion-curve'),
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        {
          label: process.platform === 'darwin' ? '缩放' : '最大化 / 还原',
          click: () =>
            window.isMaximized() ? window.unmaximize() : window.maximize(),
        },
      ],
    },
    { label: '帮助', submenu: [item(`关于 ${ProductMetadata.name}`, 'about')] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
  app.setAboutPanelOptions({
    applicationName: ProductMetadata.name,
    applicationVersion: ProductMetadata.version,
    copyright: ProductMetadata.company,
  });
}
