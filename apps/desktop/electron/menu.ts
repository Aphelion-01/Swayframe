import { app, Menu } from 'electron';
import { applicationMenus } from '../../../src/shared/application-menu';
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
        item('新建合成…', 'new-composition'),
        item('合成设置…', 'composition-settings'),
        item('导入图片到素材库…', 'import'),
        item('设置 · AI…', 'settings'),
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
    ...applicationMenus
      .filter((group) => group.label === '图层' || group.label === '动画')
      .map((group) => ({
        label: group.label,
        submenu: group.items.map(([id, label, ...keys]) =>
          id === 'create-object'
            ? {
                label,
                submenu: [
                  ['rectangle', '矩形'],
                  ['ellipse', '椭圆'],
                  ['polygon', '多边形'],
                  ['star', '星形'],
                  ['path', '路径'],
                  ['text', '文字'],
                  ['camera', '摄像机'],
                  ['solid', '纯色'],
                  ['null', '空对象'],
                ].map(([kind, name]) =>
                  item(`创建 ${name}`, `create-${kind}` as DesktopAction),
                ),
              }
            : id === 'align' || id === 'interpolation'
              ? {
                  label,
                  submenu: (id === 'align'
                    ? [
                        ['align-0', '左对齐'],
                        ['align-1', '水平居中'],
                        ['align-2', '右对齐'],
                        ['align-3', '顶对齐'],
                        ['align-4', '垂直居中'],
                        ['align-5', '底对齐'],
                        ['align-6', '水平分布'],
                        ['align-7', '垂直分布'],
                      ]
                    : [
                        ['ease-in', '缓入'],
                        ['ease-out', '缓出'],
                        ['ease-both', '缓入缓出'],
                        ['linear', '线性'],
                        ['hold', '保持'],
                      ]
                  ).map(([action, name]) =>
                    item(name!, action as DesktopAction),
                  ),
                }
              : item(label, id, keys[0]),
        ),
      })),
    {
      label: '视图',
      submenu: [
        item('放大', 'zoom-in', 'CommandOrControl+='),
        item('缩小', 'zoom-out', 'CommandOrControl+-'),
        item('适合窗口', 'fit'),
        item('实际大小', 'actual-size'),
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        ...applicationMenus
          .find((group) => group.label === '窗口')!
          .items.map(([id, label]) => item(label, id)),
        { type: 'separator' },
        { role: 'minimize' },
        {
          label: process.platform === 'darwin' ? '缩放' : '最大化 / 还原',
          click: () =>
            window.isMaximized() ? window.unmaximize() : window.maximize(),
        },
      ],
    },
    {
      label: '帮助',
      submenu: applicationMenus
        .find((group) => group.label === '帮助')!
        .items.map(([id, label, ...keys]) => item(label, id, keys[0])),
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
  app.setAboutPanelOptions({
    applicationName: ProductMetadata.name,
    applicationVersion: ProductMetadata.version,
    copyright: ProductMetadata.company,
  });
}
