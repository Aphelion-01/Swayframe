import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { toolDefinitions, type ToolId } from '../../shared/tool-registry';
export type Tool = ToolId;
export const tools = toolDefinitions;
const Context = createContext<{
  tool: Tool;
  setTool: (tool: Tool) => void;
  space: boolean;
  setSpace: (space: boolean) => void;
}>({ tool: 'select', setTool: () => {}, space: false, setSpace: () => {} });
export function ToolProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<Tool>('select'),
    [space, setSpace] = useState(false);
  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (tools.some((t) => t.id === id)) setTool(id as Tool);
    };
    window.addEventListener('motion:tool', handler);
    return () => window.removeEventListener('motion:tool', handler);
  }, []);
  return (
    <Context value={{ tool, setTool, space, setSpace }}>{children}</Context>
  );
}
export const useTools = () => useContext(Context);
