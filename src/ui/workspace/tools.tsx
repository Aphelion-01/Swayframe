import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { IconName } from './icons';
export type Tool = 'select' | 'hand' | 'rectangle' | 'ellipse' | 'pen' | 'text';
export const tools: readonly {
  id: Tool;
  label: string;
  key: string;
  icon: IconName;
}[] = [
  { id: 'select', label: '选择工具', key: 'V', icon: 'select' },
  { id: 'hand', label: '平移工具', key: 'H', icon: 'hand' },
  { id: 'rectangle', label: '矩形工具', key: 'R', icon: 'rectangle' },
  { id: 'ellipse', label: '椭圆工具', key: 'E', icon: 'ellipse' },
  { id: 'pen', label: '钢笔工具', key: 'P', icon: 'pen' },
  { id: 'text', label: '文字工具', key: 'T', icon: 'text' },
];
const Context = createContext<{
  tool: Tool;
  setTool: (tool: Tool) => void;
  space: boolean;
  setSpace: (space: boolean) => void;
}>({ tool: 'select', setTool: () => {}, space: false, setSpace: () => {} });
export function ToolProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<Tool>('select'),
    [space, setSpace] = useState(false);
  return (
    <Context value={{ tool, setTool, space, setSpace }}>{children}</Context>
  );
}
export const useTools = () => useContext(Context);
