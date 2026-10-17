import { afterEach, expect, it } from 'vitest';
import {
  EditorOperations,
  type EditorResult,
} from '../src/desktop/editor-operations';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createComposition,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { loadProject } from '../src/core/project-io';
const instances: EditorOperations[] = [];
afterEach(() => {
  for (const op of instances) op.dispose();
  instances.length = 0;
});
function fixture() {
  const c = createComposition({ width: 64, height: 48, duration: 3 }),
    a = createLayer('rectangle', { name: 'A', position: { x: 10, y: 20 } }),
    b = createLayer('ellipse', { name: 'B', position: { x: 40, y: 20 } });
  const store = new EditorStore(createDefaultProject({ ...c, layers: [a, b] }));
  const op = new EditorOperations(store);
  instances.push(op);
  return { store, op, a, b, c };
}
function data<T>(r: EditorResult<T>) {
  if (!r.ok) throw Error(JSON.stringify(r.error));
  return r.data;
}
function context(op: EditorOperations) {
  const r = op.getProjectInfo();
  if (!r.ok) throw Error(r.error.message);
  return r.context;
}
function request(
  op: EditorOperations,
  layerId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    ...context(op),
    requestId: crypto.randomUUID(),
    layerId,
    property: 'transform.position',
    value: { x: 15, y: 25 },
    time: 0,
    ...extra,
  };
}
function code(r: EditorResult<unknown>) {
  return r.ok ? 'SUCCESS' : r.error.code;
}
function unchanged(store: EditorStore) {
  return {
    json: store.save(),
    undo: store.commands.undoStack.length,
    redo: store.commands.redoStack.length,
  };
}
it('all synchronous queries are detached, explicitly ordered and leave Scene/history unchanged', () => {
  const { op, store, a, c } = fixture();
  store.select(a.id);
  const before = unchanged(store),
    ctx = context(op);
  expect(data(op.getProjectInfo()).id).toBe(ctx.projectId);
  const tree = data(op.getSceneTree(ctx));
  expect(tree.order).toBe('bottom-to-top');
  expect(tree.compositions[0]!.layers.map((l) => l.name)).toEqual(['A', 'B']);
  const detail = data(op.getLayerDetails({ ...ctx, layerId: a.id }));
  expect(detail.compositionId).toBe(c.id);
  expect(
    detail.properties.find((p) => p.key === 'transform.position')!.property.id,
  ).toBe(a.transform.position.id);
  Object.assign(detail.layer, { name: 'Client mutation' });
  expect(data(op.getSelection(ctx)).layerIds).toEqual([a.id]);
  expect(unchanged(store)).toEqual(before);
});
it('uses explicit layer and time, ignores Selection/playhead; one native undoable saveable write', () => {
  const { op, store, a, b } = fixture();
  store.select(b.id);
  store.setTime(2);
  const before = store.save(),
    r = op.setLayerProperty(request(op, a.id));
  expect(r.ok).toBe(true);
  expect(
    activeComposition(store.commands.getSnapshot()).layers[0]!.transform
      .position.baseValue,
  ).toEqual({ x: 15, y: 25 });
  expect(activeComposition(store.commands.getSnapshot()).layers[1]).toEqual(b);
  expect(store.getSnapshot().selection).toEqual([b.id]);
  expect(store.getSnapshot().time).toBe(2);
  expect(store.commands.undoStack).toHaveLength(1);
  const after = store.save();
  expect(loadProject(after).id).toBe(context(op).projectId);
  store.undo();
  expect(store.save()).toBe(before);
  store.redo();
  expect(store.save()).toBe(after);
});
it('queries against another project or stale revision are rejected', () => {
  const { op, store, a } = fixture();
  const old = context(op);
  store.run('GUI', [store.valueCommand(a.transform.opacity.id, 0.5)]);
  expect(code(op.getSceneTree(old))).toBe('STALE_BASE');
  expect(
    code(op.getSelection({ ...context(op), projectId: crypto.randomUUID() })),
  ).toBe('CONTEXT_STALE');
});
it('A: deletion after query rejects stale request, then explicit missing target without touching other layers', () => {
  const { op, store, a } = fixture();
  const r = request(op, a.id);
  store.run('GUI 删除', [
    command({
      type: 'layer.delete',
      compositionId: store.commands.getSnapshot().activeCompositionId,
      layerId: a.id,
    }),
  ]);
  const before = unchanged(store);
  expect(code(op.setLayerProperty(r))).toBe('STALE_BASE');
  expect(code(op.setLayerProperty(request(op, a.id)))).toBe(
    'INVALID_REFERENCE',
  );
  expect(unchanged(store)).toEqual(before);
});
it('B: GUI edit after query is not overwritten', () => {
  const { op, store, a } = fixture();
  const r = request(op, a.id);
  store.run('GUI 修改', [
    store.valueCommand(a.transform.position.id, { x: 50, y: 10 }),
  ]);
  const before = unchanged(store);
  expect(code(op.setLayerProperty(r))).toBe('STALE_BASE');
  expect(unchanged(store)).toEqual(before);
});
it('C: switching projects and switching back, including same-ID reload, never revives an old revision', () => {
  const { op, store, a } = fixture();
  const json = store.save(),
    r = request(op, a.id);
  store.load(JSON.stringify(createDefaultProject()));
  const before = unchanged(store);
  expect(code(op.setLayerProperty(r))).toBe('CONTEXT_STALE');
  expect(unchanged(store)).toEqual(before);
  store.load(json);
  expect(code(op.setLayerProperty(r))).toBe('STALE_BASE');
  const sameId = request(op, a.id);
  store.load(store.save());
  expect(code(op.setLayerProperty(sameId))).toBe('STALE_BASE');
});
it('E: same requestId is explicitly rejected after success, Undo and refreshed query', () => {
  const { op, store, a } = fixture();
  const r = request(op, a.id);
  expect(op.setLayerProperty(r).ok).toBe(true);
  expect(code(op.setLayerProperty(r))).toBe('REPLAY_FORBIDDEN');
  store.undo();
  const before = unchanged(store);
  expect(code(op.setLayerProperty({ ...r, ...context(op) }))).toBe(
    'REPLAY_FORBIDDEN',
  );
  expect(unchanged(store)).toEqual(before);
});
it('a new adapter has a different nonce and cannot accept requests from an old adapter', () => {
  const { op, store, a } = fixture();
  const r = request(op, a.id);
  const newer = new EditorOperations(store);
  instances.push(newer);
  expect(code(newer.setLayerProperty(r))).toBe('STALE_BASE');
});
it('invalid layer never edits current selection', () => {
  const { op, store, b } = fixture();
  store.select(b.id);
  const before = unchanged(store);
  expect(code(op.setLayerProperty(request(op, crypto.randomUUID())))).toBe(
    'INVALID_REFERENCE',
  );
  expect(unchanged(store)).toEqual(before);
});
it.each(['position', '__proto__', 'fill', 'text', 'transform.missing'])(
  'unsupported property %s safely fails',
  (property) => {
    const { op, store, a } = fixture();
    const before = unchanged(store);
    const r = op.setLayerProperty(request(op, a.id, { property }));
    expect(code(r)).toBe('INVALID_ARGUMENTS');
    expect(!r.ok && r.error.field).toBe('property');
    expect(unchanged(store)).toEqual(before);
  },
);
it('locked layers remain locked and unchanged', () => {
  const { op, store, a, c } = fixture();
  store.run('GUI 锁定', [
    command({
      type: 'layer.patch',
      compositionId: c.id,
      layerId: a.id,
      patch: { locked: true },
    }),
  ]);
  const before = unchanged(store);
  expect(code(op.setLayerProperty(request(op, a.id)))).toBe(
    'PERMISSION_DENIED',
  );
  expect(unchanged(store)).toEqual(before);
});
it('native type/range checks reject valid envelope but incorrect property value atomically', () => {
  const { op, store, a } = fixture();
  const before = unchanged(store);
  expect(
    code(
      op.setLayerProperty(
        request(op, a.id, { property: 'transform.opacity', value: 2 }),
      ),
    ),
  ).toBe('COMMAND_REJECTION');
  expect(code(op.setLayerProperty(request(op, a.id, { value: 4 })))).toBe(
    'COMMAND_REJECTION',
  );
  expect(unchanged(store)).toEqual(before);
});
it.each([
  { value: NaN },
  { time: -1 },
  { time: 100 },
  { value: { x: 1, y: 2, extra: 1 } },
  { projectId: 'other' },
  { revision: '' },
  { requestId: 'not-a-uuid' },
  { arbitraryCommand: { type: 'layer.delete' } },
])('rejects invalid envelope without mutation: %j', (extra) => {
  const { op, store, a } = fixture();
  const before = unchanged(store);
  expect(code(op.setLayerProperty(request(op, a.id, extra)))).toBe(
    'INVALID_ARGUMENTS',
  );
  expect(unchanged(store)).toEqual(before);
});
it('existing animation uses native explicit time/frame snapping, not the UI playhead', () => {
  const { op, store, a } = fixture();
  store.run(
    'GUI 动画',
    [0, 1].map((time) =>
      command({
        type: 'keyframe.add',
        propertyId: a.transform.position.id,
        keyframe: {
          id: crypto.randomUUID(),
          time,
          value: { x: time * 10, y: 20 },
          interpolation: { type: 'linear' },
        },
      }),
    ),
  );
  store.setTime(2);
  const before = store.save();
  expect(op.setLayerProperty(request(op, a.id, { time: 0.51 })).ok).toBe(true);
  const keys = activeComposition(store.commands.getSnapshot()).layers[0]!
    .transform.position.keyframes;
  expect(keys.some((k) => k.time === 0.5 && k.value.x === 15)).toBe(true);
  expect(keys.some((k) => k.time === 2)).toBe(false);
  store.undo();
  expect(store.save()).toBe(before);
});
it('selection changes alone do not invalidate Scene revision', () => {
  const { op, store, a, b } = fixture();
  const before = context(op);
  store.select(b.id);
  store.setTime(1);
  expect(context(op)).toEqual(before);
  expect(op.setLayerProperty({ ...request(op, a.id), ...before }).ok).toBe(
    true,
  );
});
it('cancellation before admission and disposed hosts cannot mutate Scene', () => {
  const { op, store, a } = fixture();
  const c = new AbortController();
  c.abort();
  const before = unchanged(store);
  expect(
    code(op.setLayerProperty(request(op, a.id), { signal: c.signal })),
  ).toBe('CANCELLED');
  const r = request(op, a.id);
  op.dispose();
  expect(code(op.getProjectInfo())).toBe('CANCELLED');
  expect(code(op.setLayerProperty(r))).toBe('CANCELLED');
  expect(unchanged(store)).toEqual(before);
});
it('bounded replay ledger never evicts IDs and silently repeats operations', () => {
  const { op, store } = fixture();
  const before = unchanged(store);
  for (let i = 0; i < 256; i++)
    expect(code(op.setLayerProperty(request(op, crypto.randomUUID())))).toBe(
      'INVALID_REFERENCE',
    );
  expect(code(op.setLayerProperty(request(op, crypto.randomUUID())))).toBe(
    'BUDGET_EXCEEDED',
  );
  expect(unchanged(store)).toEqual(before);
});
it('render validation rejects missing target, stale context and excessive source pixels before allocating', async () => {
  const { op, store } = fixture();
  const before = unchanged(store);
  expect(
    code(
      await op.renderFrame({
        ...context(op),
        compositionId: crypto.randomUUID(),
        time: 0,
      }),
    ),
  ).toBe('INVALID_REFERENCE');
  expect(
    code(
      await op.renderFrame({
        ...context(op),
        compositionId: store.commands.getSnapshot().activeCompositionId,
        time: 99,
      }),
    ),
  ).toBe('INVALID_ARGUMENTS');
  const huge = createComposition({ width: 8192, height: 8192 });
  store.load(JSON.stringify(createDefaultProject(huge)));
  const current = unchanged(store);
  expect(
    code(
      await op.renderFrame({ ...context(op), compositionId: huge.id, time: 0 }),
    ),
  ).toBe('INVALID_ARGUMENTS');
  expect(unchanged(store)).toEqual(current);
  expect(before.json).not.toBe(current.json);
});
