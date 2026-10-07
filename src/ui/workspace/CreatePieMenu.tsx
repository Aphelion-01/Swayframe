import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { activeComposition, createLayer } from '../../core/project-model';
import { command } from '../../core/command-system';
import { layerKindLabels } from '../labels';
import { importImageFile } from '../asset-import';
import { desktopService } from '../../desktop/service';
import { importNativeAssets } from '../../desktop/asset-service';
import type { EditorStore } from '../editor-store';
import { ContextMenu } from './primitives';
import type { MenuItem } from './primitives';
import { Icon } from './icons';
import type { IconName } from './icons';
const choices = [
  ['rectangle', 'rectangle'],
  ['ellipse', 'ellipse'],
  ['polygon', 'polygon'],
  ['star', 'star'],
  ['path', 'path'],
  ['text', 'text'],
  ['camera', 'camera'],
  ['solid', 'solid'],
  ['null', 'null'],
  ['image', 'image'],
] as const satisfies readonly (readonly [string, IconName])[];
export function CreatePieMenu({
  store,
  x,
  y,
  onClose,
  items = [],
}: {
  store: EditorStore;
  x: number;
  y: number;
  onClose: () => void;
  items?: readonly MenuItem[];
}) {
  const [actions, setActions] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    root = useRef<HTMLDivElement>(null);
  const size = Math.min(344, window.innerWidth - 16, window.innerHeight - 16),
    radius = size * 0.37;
  const left = Math.max(
    8,
    Math.min(window.innerWidth - size - 8, x - size / 2),
  );
  const top = Math.max(
    8,
    Math.min(window.innerHeight - size - 8, y - size / 2),
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  if (actions)
    return <ContextMenu x={left} y={top} items={items} onClose={onClose} />;
  return createPortal(
    <div
      className="creation-menu-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={root}
        className="creation-pie"
        role="menu"
        aria-label="创建对象"
        style={{ left, top, width: size, height: size }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
          if (
            ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Tab'].includes(
              e.key,
            )
          ) {
            e.preventDefault();
            const buttons = [
              ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
            ];
            const delta =
              e.shiftKey || ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1;
            buttons[
              (buttons.indexOf(document.activeElement as HTMLButtonElement) +
                delta +
                buttons.length) %
                buttons.length
            ]?.focus();
          }
        }}
      >
        {choices.map(([kind, icon], i) => (
          <button
            role="menuitem"
            aria-label={
              kind === 'image' ? '导入 图片' : `创建 ${layerKindLabels[kind]}`
            }
            key={kind}
            style={{
              left: size / 2 + Math.sin((i * Math.PI) / 5) * radius,
              top: size / 2 - Math.cos((i * Math.PI) / 5) * radius,
            }}
            onClick={() => {
              if (kind === 'image') {
                if (desktopService.native) {
                  void importNativeAssets(store);
                  onClose();
                } else input.current?.click();
                return;
              }
              const c = activeComposition(store.getSnapshot().project),
                layer = createLayer(kind, {
                  position: { x: c.width / 2, y: c.height / 2 },
                });
              if (
                store.run(`创建 ${layerKindLabels[kind]}`, [
                  command({ type: 'layer.create', compositionId: c.id, layer }),
                ]).ok
              )
                store.select(layer.id);
              onClose();
            }}
          >
            <Icon name={icon} />
            <span>{layerKindLabels[kind]}</span>
          </button>
        ))}
        <div className="creation-pie-center">
          <span>创建对象</span>
          {items.length > 0 && (
            <button onClick={() => setActions(true)} aria-label="更多图层操作">
              <Icon name="more" />
              操作
            </button>
          )}
          <button aria-label="关闭创建菜单" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <input
          ref={input}
          hidden
          type="file"
          accept="image/*"
          aria-label="导入图片文件"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void importImageFile(store, file)
                .catch((error) => store.setStatus(String(error), true))
                .finally(onClose);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
