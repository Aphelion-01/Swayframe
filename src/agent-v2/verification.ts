import { activeComposition, type Project } from '../core/project-model';
import { gradientPropertyKey } from '../core/radial-gradient';
import { evaluateProperty } from '../core/animation-engine';
import type { ObjectOutput } from '../agent/object-reference';
import type { SemanticAction } from './actions';
import { problem } from './errors';
/** Independent semantic postconditions over actual Scene, in addition to command replay verification. */
export function verifyAction(
  action: SemanticAction,
  project: Project,
  outputs: Partial<Record<ObjectOutput, string>>,
  targetId?: string,
  keyframeId?: string,
  currentTime = 0,
) {
  const fail = (field: string, expected: unknown, actual: unknown): never => {
    throw problem('VERIFICATION_FAILURE', '实际结果不符合动作目标', {
      phase: 'verification',
      actionId: action.id,
      field,
      expected,
      actual,
    });
  };
  const equal = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  if (action.type === 'createNative' || action.type === 'editNative') {
    const layer = activeComposition(project).layers.find(
      (l) =>
        l.id === (action.type === 'createNative' ? outputs.layerId : targetId),
    );
    if (!layer) fail('layer', 'real native result/target layer', null);
    if (action.type === 'createNative') {
      const expected =
        action.tool === 'createPolygon'
          ? 'polygon'
          : action.tool === 'createStar'
            ? 'star'
            : action.tool === 'createPath'
              ? 'path'
              : action.tool === 'createLayerFromAsset'
                ? undefined
                : action.args.kind;
      if (
        expected &&
        (layer!.type === 'shape' ? layer!.shapeKind : layer!.type) !== expected
      )
        fail('native kind', expected, layer!.type);
    }
    // Actual native schema + command replay + scope verification remain mandatory in EditorAdapter.verify.
    return;
  }
  const created = action.type === 'createShape' || action.type === 'createText';
  const layer = activeComposition(project).layers.find(
    (l) => l.id === (created ? outputs.layerId : targetId),
  );
  if (!layer) fail('layer', 'existing real layer', null);
  const l = layer!;
  if (
    action.type === 'setDimensions' &&
    (l.width !== action.width || l.height !== action.height)
  )
    fail(
      'dimensions',
      { width: action.width, height: action.height },
      { width: l.width, height: l.height },
    );
  if (
    action.type === 'setFont' &&
    (l.type !== 'text' || l.fontFamily !== action.fontFamily)
  )
    fail(
      'fontFamily',
      action.fontFamily,
      l.type === 'text' ? l.fontFamily : null,
    );
  if (
    action.type === 'deleteKeyframe' &&
    l.transform[action.property].keyframes.some(
      (k) => k.id === action.keyframeId,
    )
  )
    fail('keyframe', 'deleted', action.keyframeId);
  if (
    action.type === 'createShape' &&
    (l.type !== 'shape' || l.shapeKind !== action.shape)
  )
    fail('shape', action.shape, l.type);
  if (created) {
    if (action.name !== undefined && l.name !== action.name)
      fail('name', action.name, l.name);
    if (action.width !== undefined && l.width !== action.width)
      fail('width', action.width, l.width);
    if (action.height !== undefined && l.height !== action.height)
      fail('height', action.height, l.height);
    if (
      action.position &&
      !equal(action.position, l.transform.position.baseValue)
    )
      fail('position', action.position, l.transform.position.baseValue);
  }
  if (action.type === 'createText') {
    if (l.type !== 'text') fail('type', 'text', l.type);
    if (l.type === 'text')
      for (const key of ['content', 'fontSize', 'fontFamily'] as const) {
        const expected = action[key];
        const actual = key === 'content' ? l.text : l[key];
        if (expected !== undefined && expected !== actual)
          fail(key, expected, actual);
      }
    if (
      action.alignment !== undefined &&
      l.editor?.textAlign !== action.alignment
    )
      fail('alignment', action.alignment, l.editor?.textAlign);
    if (action.color) {
      const expected = [
        action.color.r,
        action.color.g,
        action.color.b,
        action.color.a,
      ];
      if (!equal(expected, l.editor?.properties.fill?.baseValue))
        fail('color', expected, l.editor?.properties.fill?.baseValue);
    }
  }
  if (action.type === 'setProperty') {
    const property =
      action.property === 'fontSize'
        ? l.type === 'text'
          ? l.editor?.properties.fontSize
          : undefined
        : l.transform[action.property];
    if (!property)
      fail(
        action.property,
        'registered property on supported layer type',
        l.type,
      );
    const actual = evaluateProperty<import('../core/core-types').AnimValue>(
      property!,
      action.time ?? currentTime,
    );
    if (!equal(action.value, actual))
      fail(action.property, action.value, actual);
  }
  if (action.type === 'setFill') {
    const expected = [
      action.color.r,
      action.color.g,
      action.color.b,
      action.color.a,
    ];
    const actual = l.editor?.properties.fill
      ? evaluateProperty(l.editor.properties.fill, action.time ?? currentTime)
      : null;
    if (!equal(expected, actual)) fail('fill', expected, actual);
    if (action.gradient && l.editor?.gradient !== action.gradient)
      fail('gradient', action.gradient, l.editor?.gradient);
    if (action.endColor) {
      const expected = [
        action.endColor.r,
        action.endColor.g,
        action.endColor.b,
        action.endColor.a,
      ];
      const p = l.editor?.properties.gradientEnd;
      if (
        !p ||
        !equal(expected, evaluateProperty(p, action.time ?? currentTime))
      )
        fail('endColor', expected, p?.baseValue);
    }
    for (const [key, value] of Object.entries(action.radialParameters ?? {})) {
      const p = l.editor?.properties[gradientPropertyKey(key)];
      if (!p || !equal(value, evaluateProperty(p, action.time ?? currentTime)))
        fail('radialParameters.' + key, value, p?.baseValue);
    }
  }
  if (
    action.type === 'addEffect' &&
    !l.editor?.graph?.nodes.some(
      (n) => n.id === outputs.effectId && n.type === action.effect,
    )
  )
    fail('effect', action.effect, outputs.effectId);
  if (action.type === 'addKeyframe') {
    const k = l.transform[action.property].keyframes.find(
      (k) => k.id === outputs.keyframeId,
    );
    if (!k || k.time !== action.time || !equal(k.value, action.value))
      fail('keyframe', { time: action.time, value: action.value }, k);
    if (action.interpolation && !equal(k?.interpolation, action.interpolation))
      fail('interpolation', action.interpolation, k?.interpolation);
  }
  if (action.type === 'modifyKeyframe') {
    const actual = l.transform[action.property].keyframes.find(
      (k) => k.id === keyframeId,
    );
    if (!actual || !equal(actual.interpolation, action.interpolation))
      fail('interpolation', action.interpolation, actual?.interpolation);
  }
}
