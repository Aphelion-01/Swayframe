import { app, Menu } from 'electron';
import {
  applicationMenus,
  menuChildren,
} from '../../../src/shared/application-menu';
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
    action: string,
    accelerator?: string,
  ): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () =>
      window.webContents.send('swayframe:action', action as DesktopAction),
  });
  const menus: MenuItemConstructorOptions[] = applicationMenus.map((group) => ({
    label: group.label,
    submenu: [
      ...group.items.map(([id, label, key]): MenuItemConstructorOptions => {
        const children = menuChildren(id);
        return children.length
          ? {
              label,
              submenu: children.map((f) =>
                item(f.title, f.commandId, f.shortcut),
              ),
            }
          : item(label, id, key);
      }),
      ...(group.label === '文件'
        ? [
            { type: 'separator' as const },
            {
              label: '最近工程',
              submenu: recents.length
                ? recents.map((r) => ({
                    label: r.displayName + (r.missing ? '（文件失联）' : ''),
                    click: () =>
                      window.webContents.send(
                        'swayframe:action',
                        'open',
                        r.path,
                      ),
                  }))
                : [{ label: '暂无最近工程', enabled: false }],
            },
            item('关闭工程', 'close-project'),
            {
              label: '关闭窗口',
              accelerator: 'CommandOrControl+W',
              click: () => window.close(),
            },
            { label: '退出', click: () => window.close() },
          ]
        : []),
      ...(group.label === '视图'
        ? [
            { type: 'separator' as const },
            { role: 'togglefullscreen' as const },
          ]
        : []),
      ...(group.label === '窗口'
        ? [
            { type: 'separator' as const },
            { role: 'minimize' as const },
            {
              label: process.platform === 'darwin' ? '缩放' : '最大化 / 还原',
              click: () =>
                window.isMaximized() ? window.unmaximize() : window.maximize(),
            },
          ]
        : []),
    ],
  }));
  if (process.platform === 'darwin')
    menus.unshift({
      label: ProductMetadata.name,
      submenu: [
        item(`关于 ${ProductMetadata.name}`, 'about'),
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Command+Q',
          click: () => window.close(),
        },
      ],
    });
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
  app.setAboutPanelOptions({
    applicationName: ProductMetadata.name,
    applicationVersion: ProductMetadata.version,
    copyright: ProductMetadata.company,
  });
}
