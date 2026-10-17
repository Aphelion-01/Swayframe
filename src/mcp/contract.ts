import { z } from 'zod';
import type { CoreError } from '../agent-v2/errors';
import {
  ownerSchema,
  layerQuery,
  propertyRequest,
  importRequest,
  renderRequest,
} from '../desktop/editor-operation-schemas';
export const toolSchemas = {
  sf_project_info: z.object({}).strict(),
  sf_scene_tree: ownerSchema,
  sf_inspect_layer: layerQuery,
  sf_selection: ownerSchema,
  sf_set_property: propertyRequest,
  sf_import_layer_package: importRequest,
  sf_render_frame: renderRequest,
} as const;
export const toolName = z.enum([
  'sf_project_info',
  'sf_scene_tree',
  'sf_inspect_layer',
  'sf_selection',
  'sf_set_property',
  'sf_import_layer_package',
  'sf_render_frame',
]);
export type ToolName = z.infer<typeof toolName>;
export const permissionsSchema = z
  .object({ edit: z.boolean(), importAssets: z.boolean() })
  .strict();
export const controlSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }).strict(),
  z.object({ action: z.literal('disable') }).strict(),
  z.object({ action: z.literal('folder') }).strict(),
  z
    .object({ action: z.literal('enable'), permissions: permissionsSchema })
    .strict(),
]);
export type Control = z.infer<typeof controlSchema>;
export interface BridgeStatus {
  enabled: boolean;
  connected: boolean;
  permissions: z.infer<typeof permissionsSchema>;
  directory: string | null;
  recent: string;
  failure: string;
}
export interface BridgeControlResult {
  status: BridgeStatus;
  config?: string;
}
export const bridgeCallSchema = z
  .object({ id: z.uuid(), tool: toolName, args: z.unknown() })
  .strict();
export type BridgeCall = z.infer<typeof bridgeCallSchema>;
export type HostEvent =
  | { type: 'call'; call: BridgeCall }
  | { type: 'cancel'; id: string }
  | { type: 'revoke' }
  | { type: 'authorize' };
export interface MCPDesktopAPI {
  control(request: Control): Promise<BridgeControlResult>;
  onEvent(listener: (event: HostEvent) => void): () => void;
  reply(id: string, result: unknown): void;
}
export function denied(message: string): { ok: false; error: CoreError } {
  return {
    ok: false,
    error: {
      code: 'PERMISSION_DENIED',
      phase: 'execution',
      message,
      recoverable: false,
      actionId: null,
      target: null,
      field: null,
      expected: null,
      actual: null,
      strategy: 'NONE',
    },
  };
}
