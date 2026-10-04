import { z } from 'zod';
import { idSchema } from '../core/project-schema';
import { activeComposition, findProperty } from '../core/project-model';
import type { Composition, Layer } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import { ProjectContextEngine } from './context-engine';
import { AgentToolError, AgentToolRegistry } from './tool-registry';
import type { AgentToolContext } from './tool-registry';
const empty = z.object({}).strict();
const layer = z.object({ layerId: idSchema }).strict();
const property = z.object({ propertyId: idSchema }).strict();
const composition = z.object({ compositionId: idSchema.optional() }).strict();
const page = {
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
};
const brief = (l: Layer) => ({
  id: l.id,
  name: l.name,
  type: l.type,
  visible: l.visible,
  locked: l.locked,
  parentId: l.editor?.parentId ?? null,
});
function getComposition(context: AgentToolContext, id?: string): Composition {
  const c = id
    ? context.project.compositions.find((c) => c.id === id)
    : activeComposition(context.project);
  if (!c) throw new AgentToolError('tool_failed', '合成不存在');
  return c;
}
function getLayer(context: AgentToolContext, id: string): Layer {
  const l = activeComposition(context.project).layers.find((l) => l.id === id);
  if (!l) throw new AgentToolError('tool_failed', '当前合成中不存在该图层');
  return l;
}
export function registerReadTools(
  registry: AgentToolRegistry,
  engine = new ProjectContextEngine(),
) {
  registry.register(
    'inspectProject',
    'Read project metadata and composition index; no filesystem or asset bodies.',
    empty,
    'READ',
    {
      read: (context) => ({
        id: context.project.id,
        name: context.project.name,
        schemaVersion: context.project.schemaVersion,
        activeCompositionId: context.project.activeCompositionId,
        compositions: context.project.compositions.slice(0, 50).map((c) => ({
          id: c.id,
          name: c.name,
          width: c.width,
          height: c.height,
          duration: c.duration,
          fps: c.fps,
          layerCount: c.layers.length,
        })),
        assetCount: context.project.assets.length,
      }),
    },
  );
  registry.register(
    'inspectComposition',
    'Read composition dimensions, timing and bounded layer summary.',
    composition,
    'READ',
    {
      read: (context, args) => {
        const c = getComposition(context, args.compositionId);
        return {
          id: c.id,
          name: c.name,
          width: c.width,
          height: c.height,
          duration: c.duration,
          fps: c.fps,
          layerCount: c.layers.length,
          layers: c.layers.slice(0, 50).map(brief),
        };
      },
    },
  );
  registry.register(
    'listLayers',
    'List a page of layers with stable IDs.',
    z.object({ ...page, compositionId: idSchema.optional() }).strict(),
    'READ',
    {
      read: (context, args) => {
        const c = getComposition(context, args.compositionId);
        const offset = args.offset ?? 0,
          limit = args.limit ?? 50;
        return {
          total: c.layers.length,
          offset,
          layers: c.layers.slice(offset, offset + limit).map(brief),
        };
      },
    },
  );
  registry.register(
    'inspectLayer',
    'Read selected layer properties, keyframes, graph summary and bounds.',
    layer,
    'READ',
    {
      read: (context, args) => {
        getLayer(context, args.layerId);
        return engine.build(
          {
            project: context.project,
            selection: [args.layerId],
            time: context.time,
          },
          16000,
        ).selected[0];
      },
    },
  );
  registry.register(
    'inspectSelection',
    'Read the current selection and active composition.',
    empty,
    'READ',
    {
      read: (context) => ({
        compositionId: context.project.activeCompositionId,
        layerIds: context.selection,
        time: context.time,
      }),
    },
  );
  registry.register(
    'inspectProperty',
    'Read property value and animated state by stable ID.',
    property,
    'READ',
    {
      read: (context, args) => {
        const found = findProperty(context.project, args.propertyId);
        return {
          propertyId: args.propertyId,
          layerId: found.layer.id,
          compositionId: found.composition.id,
          path: found.key,
          value: evaluateProperty(found.property, context.time),
          baseValue: found.property.baseValue,
          keyframeCount: found.property.keyframes.length,
        };
      },
    },
  );
  registry.register(
    'inspectKeyframes',
    'Read a page of actual persisted keyframes.',
    z.object({ ...page, propertyId: idSchema }).strict(),
    'READ',
    {
      read: (context, args) => {
        const p = findProperty(context.project, args.propertyId).property;
        return {
          propertyId: p.id,
          total: p.keyframes.length,
          keyframes: p.keyframes.slice(
            args.offset ?? 0,
            (args.offset ?? 0) + (args.limit ?? 50),
          ),
        };
      },
    },
  );
  registry.register(
    'inspectEffects',
    'Read effect node identities and actual parameters.',
    layer,
    'READ',
    {
      read: (context, args) => {
        const graph = getLayer(context, args.layerId).editor?.graph;
        return {
          layerId: args.layerId,
          effects:
            graph?.nodes
              .filter((n) => !['source', 'output'].includes(n.type))
              .slice(0, 30)
              .map((n) => ({
                id: n.id,
                type: n.type,
                name: n.name,
                enabled: n.enabled,
                parameters: Object.fromEntries(
                  Object.entries(n.params).map(([key, p]) => [
                    key,
                    {
                      propertyId: p.id,
                      value: evaluateProperty(p, context.time),
                    },
                  ]),
                ),
              })) ?? [],
        };
      },
    },
  );
  registry.register(
    'inspectGraph',
    'Read graph nodes, edges and parameters without mutation.',
    layer,
    'READ',
    {
      read: (context, args) => {
        const graph = getLayer(context, args.layerId).editor?.graph;
        if (!graph) return { graph: null };
        return {
          id: graph.id,
          owner: graph.owner,
          outputNodeId: graph.outputNodeId,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          nodes: graph.nodes.slice(0, 40).map((n) => ({
            id: n.id,
            type: n.type,
            name: n.name,
            inputs: n.inputs,
            outputs: n.outputs,
            enabled: n.enabled,
            parameters: Object.fromEntries(
              Object.entries(n.params).map(([key, p]) => [
                key,
                {
                  propertyId: p.id,
                  value: evaluateProperty(p, context.time),
                },
              ]),
            ),
          })),
          edges: graph.edges.slice(0, 60),
          truncated: graph.nodes.length > 40 || graph.edges.length > 60,
        };
      },
    },
  );
  registry.register(
    'inspectAssets',
    'Read imported asset metadata only. Never disk paths or embedded data.',
    z.object(page).strict(),
    'READ',
    {
      read: (context, args) => ({
        total: context.project.assets.length,
        assets: context.project.assets
          .slice(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 50))
          .map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            ...(a.source
              ? {
                  width: a.source.metadata.width,
                  height: a.source.metadata.height,
                }
              : {}),
          })),
      }),
    },
  );
  registry.register(
    'getCurrentTime',
    'Read current timeline time in seconds.',
    empty,
    'READ',
    { read: (context) => ({ time: context.time }) },
  );
  registry.register(
    'getCanvasInfo',
    'Read composition canvas size and active camera.',
    empty,
    'READ',
    {
      read: (context) => {
        const c = activeComposition(context.project);
        return {
          compositionId: c.id,
          width: c.width,
          height: c.height,
          bounds: { minX: 0, minY: 0, maxX: c.width, maxY: c.height },
          cameras: c.layers.filter((l) => l.type === 'camera').map(brief),
        };
      },
    },
  );
  return registry;
}
