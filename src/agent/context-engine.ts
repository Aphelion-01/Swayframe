import { activeComposition, layerProperties } from '../core/project-model';
import type { Layer, Project } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import { createRenderSnapshot } from '../core/renderer-core';
import { getWorldBounds } from '../core/layer-bounds';
import type { TextMeasure } from '../core/text-geometry';
import type { TransformInteractionSettings } from '../core/transform-context';
export interface ContextInput {
  project: Project;
  selection: readonly string[];
  time: number;
  propertyId?: string;
  transform?: TransformInteractionSettings;
  recentCommands?: readonly { label: string; source: string }[];
  measure?: TextMeasure;
}
export interface SceneSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  layerCount: number;
  layers: readonly {
    id: string;
    name: string;
    type: string;
    visible: boolean;
    locked: boolean;
    parentId?: string;
  }[];
}
export interface ProjectContext {
  untrustedData: true;
  project: {
    id: string;
    name: string;
    compositionCount: number;
    assetCount: number;
  };
  composition: SceneSummary;
  selection: readonly string[];
  currentPropertyId?: string;
  time: number;
  transform?: TransformInteractionSettings;
  selected: readonly Record<string, unknown>[];
  dependencies: readonly Record<string, unknown>[];
  assets: readonly { id: string; name: string; mimeType: string }[];
  recentCommands: readonly { label: string; source: string }[];
  truncated: boolean;
  estimatedTokens: number;
}
const brief = (layer: Layer) => ({
  id: layer.id,
  name: layer.name.slice(0, 100),
  type: layer.type,
  visible: layer.visible,
  locked: layer.locked,
  ...(layer.editor?.parentId ? { parentId: layer.editor.parentId } : {}),
});
export class ProjectContextEngine {
  private readonly cache = new WeakMap<Project, SceneSummary>();
  summary(project: Project): SceneSummary {
    const cached = Object.isFrozen(project)
      ? this.cache.get(project)
      : undefined;
    if (cached) return cached;
    const c = activeComposition(project);
    const result: SceneSummary = {
      id: c.id,
      name: c.name.slice(0, 100),
      width: c.width,
      height: c.height,
      duration: c.duration,
      fps: c.fps,
      layerCount: c.layers.length,
      layers: c.layers.slice(0, 40).map(brief),
    };
    if (Object.isFrozen(project)) this.cache.set(project, result);
    return result;
  }
  build(input: ContextInput, maxCharacters = 16000): ProjectContext {
    if (
      !Number.isFinite(maxCharacters) ||
      maxCharacters < 4000 ||
      maxCharacters > 64000
    )
      throw new Error('上下文预算需为4000～64000字符');
    const project = input.project,
      c = activeComposition(project);
    if (
      !Number.isFinite(input.time) ||
      input.time < 0 ||
      input.time > c.duration
    )
      throw new Error('上下文时间无效');
    const selection = input.selection
      .filter((id) => c.layers.some((l) => l.id === id))
      .slice(0, 100);
    const selected = c.layers.filter((l) => selection.includes(l.id));
    const snapshot = createRenderSnapshot(
      c,
      input.time,
      [],
      undefined,
      project,
    );
    const rich = (layer: Layer) => {
      const render = snapshot.layers.find((v) => v.source.id === layer.id);
      const properties = layerProperties(layer)
        .slice(0, 24)
        .map(({ key, property }) => ({
          path: key,
          id: property.id,
          value: evaluateProperty(property, input.time),
          keyframeCount: property.keyframes.length,
          keyframes: property.keyframes.slice(0, 8).map((k) => ({
            id: k.id,
            time: k.time,
            value: k.value,
            interpolation: k.interpolation,
          })),
        }));
      return {
        ...brief(layer),
        width: layer.width,
        height: layer.height,
        ...(layer.type === 'text'
          ? { text: layer.text.slice(0, 1000), fontFamily: layer.fontFamily }
          : {}),
        ...(layer.type === 'image' ? { assetId: layer.assetId } : {}),
        ...(render
          ? { bounds: getWorldBounds(render, input.time, input.measure) }
          : {}),
        properties,
        graph: layer.editor?.graph
          ? {
              id: layer.editor.graph.id,
              nodeCount: layer.editor.graph.nodes.length,
              nodes: layer.editor.graph.nodes
                .slice(0, 16)
                .map((n) => ({ id: n.id, type: n.type, enabled: n.enabled })),
              edgeCount: layer.editor.graph.edges.length,
            }
          : null,
        masks: layer.editor?.masks
          .map((m) => ({ id: m.id, mode: m.mode }))
          .slice(0, 8),
      };
    };
    const parents = new Set<string>();
    for (const layer of selected) {
      let id = layer.editor?.parentId;
      while (id && !parents.has(id)) {
        parents.add(id);
        id = c.layers.find((l) => l.id === id)?.editor?.parentId;
      }
    }
    const result: ProjectContext = {
      untrustedData: true,
      project: {
        id: project.id,
        name: project.name.slice(0, 100),
        compositionCount: project.compositions.length,
        assetCount: project.assets.length,
      },
      composition: this.summary(project),
      selection,
      currentPropertyId: input.propertyId,
      time: input.time,
      transform: input.transform,
      selected: selected.slice(0, 12).map(rich),
      dependencies: c.layers
        .filter((l) => parents.has(l.id))
        .slice(0, 8)
        .map(brief),
      assets: project.assets
        .filter((a) =>
          selected.some((l) => l.type === 'image' && l.assetId === a.id),
        )
        .slice(0, 12)
        .map((a) => ({
          id: a.id,
          name: a.name.slice(0, 100),
          mimeType: a.mimeType,
        })),
      recentCommands: (input.recentCommands ?? []).slice(-5).map((item) => ({
        label: item.label.slice(0, 200),
        source: item.source,
      })),
      truncated: c.layers.length > 40 || selected.length > 12,
      estimatedTokens: 0,
    };
    const length = () => JSON.stringify(result).length;
    while (length() > maxCharacters - 32) {
      result.truncated = true;
      if (result.dependencies.length) {
        result.dependencies = result.dependencies.slice(0, -1);
      } else if (result.composition.layers.length > 6) {
        result.composition = {
          ...result.composition,
          layers: result.composition.layers.slice(0, -1),
        };
      } else if (
        result.selected.some(
          (l) => Array.isArray(l.properties) && l.properties.length,
        )
      ) {
        result.selected = result.selected.map((l) => ({
          ...l,
          properties: (l.properties as unknown[]).slice(
            0,
            Math.floor((l.properties as unknown[]).length / 2),
          ),
        }));
      } else if (result.selected.length) {
        result.selected = result.selected.slice(0, -1);
      } else if (result.composition.layers.length) {
        result.composition = {
          ...result.composition,
          layers: result.composition.layers.slice(0, -1),
        };
      } else if (result.assets.length) {
        result.assets = result.assets.slice(0, -1);
      } else if (result.recentCommands.length) {
        result.recentCommands = [];
      } else {
        result.selection = result.selection.slice(0, -1);
      }
    }
    result.estimatedTokens = Math.ceil(length() / 2);
    return result;
  }
}
