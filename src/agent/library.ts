import { z } from 'zod';
import type { AIStorage } from '../ai/contracts';
import type { AgentSession } from './session';
import {
  propertySchema,
  animValueSchema,
  idSchema,
} from '../core/project-schema';
import {
  activeComposition,
  layerProperties,
  replaceProperty,
} from '../core/project-model';
import type { Project, Layer, Property } from '../core/project-model';
import type { AnimValue } from '../core/core-types';
import { command } from '../core/command-system';
import { AgentToolRegistry } from './tool-registry';
import { editableLayer } from './write-tools';
const conversationSchema = z
  .array(
    z
      .object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })
      .strict(),
  )
  .max(20);
export const agentHistorySchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    projectName: z.string().max(200),
    at: z.number().finite(),
    status: z.enum(['completed', 'failed', 'cancelled']),
    conversation: conversationSchema,
    summary: z.string().max(2000),
  })
  .strict();
export type AgentHistory = z.infer<typeof agentHistorySchema>;
const savedPropertySchema = propertySchema(animValueSchema);
export const agentPresetSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(100),
    createdAt: z.number().finite(),
    properties: z
      .array(
        z
          .object({
            key: z
              .string()
              .regex(
                /^(transform\.(position|scale|rotation|opacity)|editor\.properties\.[A-Za-z][A-Za-z0-9]*)$/,
              ),
            property: savedPropertySchema,
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict();
export type AgentResultPreset = z.infer<typeof agentPresetSchema>;
export class AgentLibrary {
  private state: {
    ready: boolean;
    history: AgentHistory[];
    presets: AgentResultPreset[];
    error: string | null;
  } = { ready: false, history: [], presets: [], error: null };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: AIStorage) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(patch: Partial<typeof this.state>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private initialization: Promise<void> | undefined;
  initialize() {
    return (this.initialization ??= this.load());
  }
  private async load() {
    try {
      const [h, p] = await Promise.all([
        this.storage.readData('history'),
        this.storage.readData('presets'),
      ]);
      const history = z.array(agentHistorySchema).max(100).safeParse(h),
        presets = z.array(agentPresetSchema).max(100).safeParse(p);
      this.set({
        ready: true,
        history: history.success ? history.data : [],
        presets: presets.success ? presets.data : [],
      });
    } catch {
      this.set({ ready: true, error: '助手资料读取失败' });
    }
  }
  private write(
    key: 'history' | 'presets',
    update: () => AgentHistory[] | AgentResultPreset[],
  ) {
    const task = this.queue.then(async () => {
      await this.initialize();
      const values = update();
      await this.storage.writeData(key, values);
      this.set({ [key]: values, error: null });
    });
    this.queue = task.catch(() => {
      this.set({ error: '助手资料保存失败' });
    });
    return task;
  }
  record(project: Project, session: AgentSession) {
    if (
      !['completed', 'failed', 'cancelled'].includes(session.status) ||
      !session.conversation.length
    )
      return Promise.resolve();
    const value = agentHistorySchema.parse({
      id: session.sessionId,
      projectId: project.id,
      projectName: project.name,
      at: Date.now(),
      status: session.status,
      conversation: session.conversation
        .map((m) => ({ ...m, content: m.content.slice(0, 2000) }))
        .slice(-20),
      summary: (session.error ?? session.response).slice(0, 2000),
    });
    return this.write('history', () =>
      [...this.state.history.filter((h) => h.id !== value.id), value].slice(
        -100,
      ),
    );
  }
  clear(projectId: string) {
    return this.write('history', () =>
      this.state.history.filter((h) => h.projectId !== projectId),
    );
  }
  savePreset(layer: Layer, name: string) {
    const properties = layerProperties(layer)
      .filter(
        (p) =>
          p.property.keyframes.length > 0 &&
          /^(transform\.(position|scale|rotation|opacity)|editor\.properties\.[A-Za-z][A-Za-z0-9]*)$/.test(
            p.key,
          ),
      )
      .map((p) => ({ key: p.key, property: p.property }));
    if (!properties.length) throw Error('请选择包含关键帧的图层');
    const value = agentPresetSchema.parse({
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: Date.now(),
      properties,
    });
    return this.write('presets', () =>
      [...this.state.presets, value].slice(-100),
    );
  }
  deletePreset(id: string) {
    return this.write('presets', () =>
      this.state.presets.filter((p) => p.id !== id),
    );
  }
}
const instances = new WeakMap<AIStorage, AgentLibrary>();
export function agentLibraryFor(storage: AIStorage) {
  let library = instances.get(storage);
  if (!library) {
    library = new AgentLibrary(storage);
    instances.set(storage, library);
    void library.initialize();
  }
  return library;
}
export function registerPresetTools(
  registry: AgentToolRegistry,
  library: AgentLibrary,
) {
  registry.register(
    'listAgentPresets',
    '读取用户保存的实际动画属性预设',
    z.object({}).strict(),
    'READ',
    {
      read: () =>
        library.getSnapshot().presets.map((p) => ({
          id: p.id,
          name: p.name,
          properties: p.properties.map((v) => v.key),
        })),
    },
  );
  registry.register(
    'applyAgentPreset',
    '应用保存的实际属性值、关键帧与曲线；保留目标Property ID',
    z.object({ presetId: idSchema, layerId: idSchema }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { c, layer } = editableLayer(ctx, args.layerId),
          preset = library
            .getSnapshot()
            .presets.find((p) => p.id === args.presetId);
        if (!preset) throw Error('预设不存在');
        let next = layer;
        for (const entry of preset.properties) {
          const target = layerProperties(next).find((p) => p.key === entry.key);
          if (!target) throw Error('预设与图层属性不兼容');
          if (entry.property.keyframes.some((k) => k.time > c.duration))
            throw Error('预设关键帧超出合成时长');
          const property: Property<AnimValue> = {
            ...entry.property,
            id: target.property.id,
            keyframes: entry.property.keyframes.map((k) => ({
              ...k,
              id: crypto.randomUUID(),
            })),
          };
          next = replaceProperty(next, target.property.id, property);
        }
        return [
          command({
            type: 'layer.replace',
            compositionId: activeComposition(ctx.project).id,
            layer: next,
          }),
        ];
      },
    },
  );
  return registry;
}
