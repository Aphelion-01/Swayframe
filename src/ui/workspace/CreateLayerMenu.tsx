import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createObject, objectChoices } from './object-actions';
import { layerKindLabels } from '../labels';
import { importImageFile } from '../asset-import';
import { desktopService } from '../../desktop/service';
import { importNativeAssets } from '../../desktop/asset-service';
import type { EditorStore } from '../editor-store';
import { ContextMenu, type MenuItem } from './primitives';
import { Icon } from './icons';
export function CreateLayerMenu({
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
  const picking = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const element = input.current;
    const cancel = () => onClose();
    element?.addEventListener('cancel', cancel);
    return () => element?.removeEventListener('cancel', cancel);
  }, [onClose]);
  const choices = objectChoices.map(([kind, icon]) => ({
    label: kind === 'image' ? '导入 图片' : `创建 ${layerKindLabels[kind]}`,
    icon: <Icon name={icon} />,
    action: () => {
      if (kind === 'image') {
        if (desktopService.native) {
          void importNativeAssets(store);
          onClose();
        } else {
          picking.current = true;
          input.current?.click();
        }
      } else {
        createObject(store, kind);
        onClose();
      }
    },
  }));
  return createPortal(
    <>
      <ContextMenu
        label="创建对象"
        x={x}
        y={y}
        onClose={() => {
          if (!picking.current) onClose();
        }}
        items={
          items.length
            ? [
                { label: '新建图层', action: () => {}, children: choices },
                ...items,
              ]
            : choices
        }
      />
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
    </>,
    document.body,
  );
}
