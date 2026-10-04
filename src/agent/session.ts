import { z } from 'zod';
import { newId } from '../core/core-types';
import type { Project } from '../core/project-model';
import type {
  ChatRequest,
  ChatResponse,
  ToolDefinition,
} from '../ai/contracts';
export const planStepSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
    tool: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();
export const agentPlanSchema = z
  .object({
    id: z.string().min(1).max(100),
    goal: z.string().min(1).max(1000),
    steps: z.array(planStepSchema).min(1).max(100),
    risk: z.enum(['low', 'medium', 'high']),
  })
  .strict();
export type AgentPlan = z.infer<typeof agentPlanSchema>;
export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type ToolPermission = 'READ' | 'WRITE' | 'DESTRUCTIVE';
export interface AgentActivity {
  id: string;
  tool: string;
  label: string;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
}
export interface AgentChangeSet {
  added: readonly string[];
  modified: readonly string[];
  deleted: readonly string[];
  transactionId?: string;
}
export interface AgentSession {
  sessionId: string;
  activeProjectId: string | null;
  conversation: readonly { role: 'user' | 'assistant'; content: string }[];
  selectedContext: unknown;
  currentPlan: AgentPlan | null;
  toolCalls: readonly AgentActivity[];
  usage: ChatResponse['usage'][];
  status: AgentStatus;
  mode: 'ASSIST' | 'AGENT';
  pendingConfirmation: boolean;
  changes: AgentChangeSet | null;
  error: string | null;
  response: string;
  beforeSnapshot?: string;
  afterSnapshot?: string;
}
export const emptySession = (
  mode: 'ASSIST' | 'AGENT' = 'AGENT',
): AgentSession => ({
  sessionId: newId(),
  activeProjectId: null,
  conversation: [],
  selectedContext: null,
  currentPlan: null,
  toolCalls: [],
  usage: [],
  status: 'idle',
  mode,
  pendingConfirmation: false,
  changes: null,
  error: null,
  response: '',
});
export interface AgentTransactionPort {
  execute(tool: string, args: unknown, signal: AbortSignal): Promise<unknown>;
  getSnapshot(): Project;
  commit(label: string): AgentChangeSet;
  discard(): void;
}
export interface AgentRuntimePort {
  project(): Project;
  context(prompt: string): unknown;
  tools(): readonly ToolDefinition[];
  readTools?(): readonly ToolDefinition[];
  permission(tool: string, args: unknown): ToolPermission;
  validate(plan: AgentPlan): void;
  inspect?(tool: string, args: unknown, signal: AbortSignal): Promise<unknown>;
  begin(project: Project): AgentTransactionPort;
  verify?(
    project: Project,
    signal: AbortSignal,
  ): Promise<{
    ok: boolean;
    message: string;
    image?: string;
    refinement?: AgentPlan;
  }>;
  render?(project: Project, signal: AbortSignal): Promise<string>;
}
export interface AgentModelPort {
  chat(
    task: 'general' | 'planning' | 'vision',
    request: Omit<ChatRequest, 'model'>,
    signal?: AbortSignal,
    onText?: (text: string) => void,
  ): Promise<ChatResponse>;
}
