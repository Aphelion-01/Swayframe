import { useEffect, useState } from 'react';
import { desktopService } from '../desktop/service';
import { TextField } from './fields';
const genericFonts = ['sans-serif', 'serif', 'monospace'];
/** Uses the existing registered text Section and layer.patch preview/commit path. */
export function SystemFontField(props: {
  value: string;
  onPreview: (value: string) => void;
  onCancel: () => void;
  onCommit: (value: string) => void;
}) {
  const [families, setFamilies] = useState<string[]>([]);
  const [status, setStatus] = useState('正在读取系统字体…');
  useEffect(() => {
    let live = true;
    const api = desktopService.api?.fonts;
    if (!api) {
      setStatus('浏览器模式可输入字体名称；桌面版自动读取系统字体');
      return;
    }
    void api
      .list()
      .then((list) => {
        if (!live) return;
        setFamilies(list);
        setStatus(`已读取 ${list.length} 个系统字体，可输入名称筛选`);
      })
      .catch(() => {
        if (live) setStatus('系统字体读取失败，仍可手动输入字体名称');
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="system-font-field">
      <TextField
        label="字体"
        {...props}
        options={[...new Set([...genericFonts, ...families, props.value])]}
      />
      <small role="status">{status}</small>
    </div>
  );
}
