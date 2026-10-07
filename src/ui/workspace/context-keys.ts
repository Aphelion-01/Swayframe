import { activeComposition } from '../../core/project-model';
import type { EditorView } from '../editor-store';
import type { FocusContext } from './shortcuts';
import type { ContextValues } from '../../shared/feature-registry';
export function contextKeys(
  view: Pick<
    EditorView,
    'project' | 'selection' | 'frames' | 'selectedProperties' | 'graphSelection'
  >,
  focus: FocusContext = 'global',
): ContextValues {
  const layers = activeComposition(view.project).layers.filter((l) =>
    view.selection.includes(l.id),
  );
  return {
    Global: true,
    Project: true,
    Composition: true,
    Selection: !!(
      layers.length ||
      view.frames.length ||
      view.graphSelection?.nodeIds.length
    ),
    LayerSelection: !!layers.length,
    PropertySelection: !!view.selectedProperties.length,
    KeyframeSelection: !!view.frames.length,
    GraphSelection: !!view.graphSelection?.nodeIds.length,
    CanvasMode: focus === 'canvas',
    TimelineMode: focus === 'timeline',
    TextEditing: focus === 'text',
    '3DMode': layers.some((l) => !!l.editor?.is3D),
    AssistantMode: false,
    hasMotionTarget: !!(view.frames.length || view.selectedProperties.length),
    hasSelection: !!(layers.length || view.frames.length),
    hasLayerSelection: !!layers.length,
    hasMultipleLayers: layers.length > 1,
    hasPropertySelection: !!view.selectedProperties.length,
    hasKeyframeSelection: !!view.frames.length,
    hasSingleEditableLayer:
      layers.length === 1 && !layers[0]!.locked && !!layers[0]!.editor,
    isShapeSelected: layers.length === 1 && layers[0]!.type === 'shape',
    isTextSelected: layers.length === 1 && layers[0]!.type === 'text',
    isCameraSelected: layers.length === 1 && layers[0]!.type === 'camera',
    isPrecompSelected: layers.length === 1 && layers[0]!.type === 'precomp',
    is3DLayer: layers.some((l) => !!l.editor?.is3D),
    canPrecompose: layers.length > 0 && layers.every((l) => !l.locked),
    canParent:
      layers.length > 0 &&
      layers.every((l) => l.type !== 'camera' && !l.locked),
    canAnimate: layers.some((l) => !l.locked),
    graphMode: focus === 'compositing',
    timelineMode: focus === 'timeline',
    textEditing: focus === 'text',
  };
}
