const builtInTools = [
  {
    id: 'select',
    label: '选择工具',
    key: 'V',
    icon: 'select',
    group: 'navigate',
    order: 10,
  },
  {
    id: 'hand',
    label: '平移工具',
    key: 'H',
    icon: 'hand',
    group: 'navigate',
    order: 20,
  },
  {
    id: 'rectangle',
    label: '矩形工具',
    key: 'R',
    icon: 'rectangle',
    group: 'draw',
    order: 30,
  },
  {
    id: 'ellipse',
    label: '椭圆工具',
    key: 'E',
    icon: 'ellipse',
    group: 'draw',
    order: 40,
  },
  {
    id: 'pen',
    label: '钢笔工具',
    key: 'P',
    icon: 'pen',
    group: 'draw',
    order: 50,
  },
  {
    id: 'text',
    label: '文字工具',
    key: 'T',
    icon: 'text',
    group: 'draw',
    order: 60,
  },
] as const;
export type ToolId = (typeof builtInTools)[number]['id'];

export interface ToolDefinition {
  id: string;
  label: string;
  key: string;
  icon: string;
  group: 'navigate' | 'draw';
  order: number;
}
export class ToolRegistry {
  private readonly items = new Map<string, ToolDefinition>();
  register(tool: ToolDefinition) {
    if (this.items.has(tool.id)) throw Error('工具重复注册');
    if (!tool.key || !tool.icon || !tool.group) throw Error('工具定义缺失');
    this.items.set(tool.id, tool);
  }
  all() {
    return [...this.items.values()].sort((a, b) => a.order - b.order);
  }
}
export const toolRegistry = new ToolRegistry();
for (const tool of builtInTools) toolRegistry.register(tool);
export const toolDefinitions =
  toolRegistry.all() as readonly (typeof builtInTools)[number][];
