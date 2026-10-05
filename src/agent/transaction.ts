import { CommandSystem, transaction } from '../core/command-system';
import type { Command } from '../core/command-system';
import { activeComposition } from '../core/project-model';
import type { Project } from '../core/project-model';
import type { TransformInteractionSettings } from '../core/transform-context';
import { defaultTransformSettings } from '../core/transform-context';
import type { AgentChangeSet, AgentTransactionPort } from './session';
import type { AgentToolContext, AgentToolRegistry } from './tool-registry';
export interface AgentTransactionHost {
  getSnapshot(): Project;
  executeTransaction: CommandSystem['executeTransaction'];
  applyWorkspace?: (settings: TransformInteractionSettings) => void;
}
export class AgentTransaction implements AgentTransactionPort {
  private readonly sandbox: CommandSystem;
  private readonly pending: Command[] = [];
  private closed = false;
  private transform: TransformInteractionSettings;
  private workspaceChanged = false;
  constructor(
    private readonly host: AgentTransactionHost,
    private readonly registry: AgentToolRegistry,
    private readonly base: Project,
    private readonly context: Omit<AgentToolContext, 'project'>,
    private readonly destructiveConfirmed = false,
    private readonly allowedTools?: readonly string[],
  ) {
    this.sandbox = new CommandSystem(base);
    this.transform = context.transform ?? defaultTransformSettings;
  }
  getSnapshot = () => this.sandbox.getSnapshot();
  get commandCount() {
    return this.pending.length;
  }
  async execute(name: string, args: unknown, signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.closed) throw new Error('Agent 事务已结束');
    const context = {
      ...this.context,
      project: this.sandbox.getSnapshot(),
      time: Math.min(
        this.context.time,
        activeComposition(this.sandbox.getSnapshot()).duration,
      ),
      transform: this.transform,
    };
    const permission = this.registry.permission(name, args, this.allowedTools);
    if (permission === 'READ')
      return this.registry.read(name, args, context, signal, this.allowedTools);
    if (permission === 'DESTRUCTIVE' && !this.destructiveConfirmed)
      throw new Error('危险操作尚未确认');
    const workspace = this.registry.workspacePatch(
      name,
      args,
      context,
      this.allowedTools,
    );
    const commands = this.registry.compile(
      name,
      args,
      context,
      this.destructiveConfirmed,
      this.allowedTools,
    );
    if (this.pending.length + commands.length > 500)
      throw new Error('Agent 操作超过500条命令，请缩小任务范围');
    if (commands.length) {
      const result = this.sandbox.executeTransaction(
        transaction('Agent预验证：' + name, 'agent', commands),
      );
      if (!result.ok) throw new Error(result.error);
      this.pending.push(...commands);
    }
    if (workspace) {
      this.transform = { ...this.transform, ...workspace };
      this.workspaceChanged = true;
    }
    signal.throwIfAborted();
    return { ok: true, commandCount: commands.length };
  }
  commit(label: string): AgentChangeSet {
    if (this.closed) throw new Error('Agent 事务已结束');
    if (this.host.getSnapshot() !== this.base)
      throw new Error('工程已修改，Agent 结果未提交');
    const next = this.sandbox.getSnapshot(),
      changes = this.diff(next);
    let transactionId: string | undefined;
    if (this.pending.length) {
      const result = this.host.executeTransaction(
        transaction(label.slice(0, 500), 'agent', this.pending),
      );
      if (!result.ok) throw new Error(result.error);
      transactionId = result.transactionId;
    }
    this.closed = true;
    this.pending.length = 0;
    if (this.workspaceChanged) this.host.applyWorkspace?.(this.transform);
    return { ...changes, ...(transactionId ? { transactionId } : {}) };
  }
  discard() {
    this.closed = true;
    this.pending.length = 0;
  }
  private diff(next: Project): AgentChangeSet {
    const oldLayers = new Map(
        this.base.compositions.flatMap((c) =>
          c.layers.map((l) => [l.id, l] as const),
        ),
      ),
      newLayers = new Map(
        next.compositions.flatMap((c) =>
          c.layers.map((l) => [l.id, l] as const),
        ),
      );
    const added: string[] = [],
      modified: string[] = [],
      deleted: string[] = [];
    for (const [id, layer] of newLayers) {
      const old = oldLayers.get(id);
      if (!old) added.push(layer.name);
      else if (JSON.stringify(old) !== JSON.stringify(layer))
        modified.push(layer.name);
    }
    for (const [id, layer] of oldLayers)
      if (!newLayers.has(id)) deleted.push(layer.name);
    for (const c of next.compositions)
      if (!this.base.compositions.some((v) => v.id === c.id))
        added.push('合成：' + c.name);
    if (this.workspaceChanged) modified.push('工作区变换设置');
    return { added, modified, deleted };
  }
}
