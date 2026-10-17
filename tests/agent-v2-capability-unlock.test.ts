// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { AgentSnapshotRenderer } from '../src/agent/vision';
import {
  sessionFixture,
  existing,
  result,
  rgb,
} from './helpers/agent-v2-session-fixture';
import { activeComposition, createLayer } from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { saveProject } from '../src/core/project-io';
import type { SemanticAction } from '../src/agent-v2/actions';
type NativeArgs = Extract<SemanticAction, { type: 'editNative' }>['args'];
import { validateRepair } from '../src/agent-v2/recovery';
import { validateIntent } from '../src/agent-v2/planner';
afterEach(() => vi.restoreAllMocks());
async function setup() {
  vi.spyOn(AgentSnapshotRenderer.prototype, 'render').mockResolvedValue({
    image: 'data:image/png;base64,YQ==',
    pixelEvidence: { width: 10, height: 10, foregroundPixels: 1 },
  } as Awaited<ReturnType<AgentSnapshotRenderer['render']>>);
  return sessionFixture();
}
const layers = (s: Awaited<ReturnType<typeof setup>>) =>
  activeComposition(s.store.commands.getSnapshot()).layers;
it('explicit direct mode creates without selection, continues result reference, rotates, undo/redo and reloads', async () => {
  const s = await setup();
  expect(s.core.editMode).toBe('review');
  s.core.setEditMode('direct');
  s.enqueue([
    {
      id: 'r',
      type: 'createShape',
      shape: 'rectangle',
      width: 100,
      height: 60,
    },
  ]);
  await s.core.run('创建一个矩形');
  expect(s.core.state?.phase).toBe('COMPLETED');
  expect(layers(s)).toHaveLength(1);
  const id = layers(s)[0]!.id;
  s.enqueue([
    { id: 'red', type: 'setFill', target: existing(id), color: rgb(1, 0, 0) },
    {
      id: 'center',
      type: 'setProperty',
      target: existing(id),
      property: 'position',
      value: { x: 960, y: 540 },
    },
    ...[0, 2].map((time) => ({
      id: 'k' + time,
      type: 'addKeyframe' as const,
      target: existing(id),
      property: 'rotation' as const,
      time,
      value: time * 180,
      interpolation: { type: 'linear' as const },
    })),
  ]);
  await s.core.run('把它改成红色，移动到画布中央，给它添加两秒旋转动画');
  expect(s.core.state?.phase).toBe('COMPLETED');
  expect(
    layers(s)[0]!.transform.rotation.keyframes.map((k) => k.value),
  ).toEqual([0, 360]);
  const saved = s.store.save();
  const undo = s.store.commands.undoStack.length;
  await s.core.run('把刚才的修改撤销。');
  expect(s.store.commands.undoStack).toHaveLength(undo - 1);
  expect(layers(s)[0]!.transform.rotation.keyframes).toHaveLength(0);
  s.store.redo();
  expect(s.store.save()).toBe(saved);
  expect(s.store.load(saved)).toBe(true);
  expect(s.store.save()).toBe(saved);
});
it('no selection unique text and actual name resolve; duplicate names require clarification without calls', async () => {
  const s = await setup();
  await s.turn('创建一个标题，内容为 Swayframe', [
    { id: 't', type: 'createText', content: 'Swayframe', name: 'Hero' },
  ]);
  await s.turn('把标题改成红色', [
    {
      id: 'f',
      type: 'setFill',
      target: existing(layers(s)[0]!.id),
      color: rgb(1, 0, 0),
    },
  ]);
  expect(
    s.core.session.resolveRequest(
      '修改 Hero 的宽度',
      s.store.commands.getSnapshot(),
      [],
    ).ids,
  ).toEqual([layers(s)[0]!.id]);
  s.store.run('duplicate name', [
    command({
      type: 'layer.create',
      compositionId: s.store.commands.getSnapshot().activeCompositionId,
      layer: createLayer('text', { name: 'Hero' }),
    }),
  ]);
  const calls = s.calls.length;
  await expect(s.core.run('把 Hero 改成红色')).rejects.toThrow('多个候选');
  expect(s.calls).toHaveLength(calls);
});
it('recent middle reference is stable and two-second rotation uses original animation tools', async () => {
  const s = await setup();
  await s.turn(
    '创建三个矩形',
    [0, 1, 2].map((i) => ({
      id: 'r' + i,
      type: 'createShape',
      shape: 'rectangle',
    })),
  );
  const ids = s.core.session.recentlyCreated;
  await s.turn(
    '让刚才创建的中间矩形在两秒内旋转一圈',
    [0, 2].map((time) => ({
      id: 'k' + time,
      type: 'addKeyframe',
      target: existing(ids[1]!),
      property: 'rotation',
      value: time * 180,
      time,
    })),
  );
  expect(layers(s).map((l) => l.transform.rotation.keyframes.length)).toEqual([
    0, 2, 0,
  ]);
  const ctx = JSON.parse(
    s.calls.at(-1)!.messages[0]!.content.split('\n').at(-1)!,
  ).context.session;
  expect(ctx.reads.sceneTree[0].layers).toHaveLength(3);
  expect(ctx.reads.relevantScene[0].id).toBe(ids[1]);
});
it('native creation and mask route through registered commands with review fallback', async () => {
  const s = await setup();
  s.core.setEditMode('direct');
  s.enqueue([
    {
      id: 'star',
      type: 'createNative',
      tool: 'createStar',
      args: { name: 'Star' },
    },
    {
      id: 'mask',
      type: 'editNative',
      tool: 'createMask',
      target: result('star'),
      args: { kind: 'ellipse' },
    },
  ]);
  await s.core.run('创建一个星形，并加椭圆遮罩');
  expect(s.core.pending).toBe(true);
  expect(layers(s)).toHaveLength(0);
  expect(s.core.reviewReason).toContain('审阅');
  s.core.accept();
  expect(layers(s)[0]!.type).toBe('shape');
  expect(layers(s)[0]!.editor?.masks).toHaveLength(1);
  const saved = s.store.save();
  s.store.undo();
  expect(layers(s)).toHaveLength(0);
  s.store.redo();
  expect(s.store.save()).toBe(saved);
});
it.each([
  'renameLayer',
  'setLayerVisibility',
  'setTextContent',
  'setStroke',
] as const)('native %s actual schema and command path', async (tool) => {
  const s = await setup();
  await s.turn(tool === 'setStroke' ? '创建一个矩形' : '创建一个文字', [
    tool === 'setStroke'
      ? { id: 't', type: 'createShape', shape: 'rectangle' }
      : { id: 't', type: 'createText', content: 'Before' },
  ]);
  const id = layers(s)[0]!.id;
  const args: NativeArgs =
    tool === 'renameLayer'
      ? { name: 'After' }
      : tool === 'setLayerVisibility'
        ? { visible: false }
        : tool === 'setTextContent'
          ? { content: 'After' }
          : { color: rgb(1, 0, 0), width: 4 };
  const before = s.store.save();
  await s.turn('修改刚才的对象', [
    { id: 'edit', type: 'editNative', target: existing(id), tool, args },
  ]);
  expect(s.store.save()).not.toBe(before);
  s.store.undo();
  expect(s.store.save()).toBe(before);
});
it('native invalid argument, target override and foreign property cannot publish partial work', async () => {
  for (const args of [
    { visible: 'bad' },
    { visible: true, layerId: crypto.randomUUID() },
  ] as NativeArgs[]) {
    const s = await setup();
    await s.turn('创建一个矩形', [
      { id: 'r', type: 'createShape', shape: 'rectangle' },
    ]);
    const before = s.store.save(),
      history = s.store.commands.undoStack.length;
    s.enqueue([
      {
        id: 'edit',
        type: 'editNative',
        tool: 'setLayerVisibility',
        target: existing(layers(s)[0]!.id),
        args,
      },
    ]);
    await s.core.run('修改刚才的矩形');
    expect(s.core.state?.phase).toBe('FAILED');
    expect(s.store.save()).toBe(before);
    expect(s.store.commands.undoStack).toHaveLength(history);
  }
  const s = await setup();
  await s.turn('创建两个矩形', [
    { id: 'a', type: 'createShape', shape: 'rectangle' },
    { id: 'b', type: 'createShape', shape: 'rectangle' },
  ]);
  const before = s.store.save();
  s.enqueue([
    {
      id: 'bad',
      type: 'editNative',
      target: existing(layers(s)[0]!.id),
      tool: 'addKeyframe',
      args: {
        propertyId: layers(s)[1]!.transform.opacity.id,
        time: 0,
        value: 0.2,
      },
    },
  ]);
  await s.core.run('修改第一个矩形');
  expect(s.core.state?.phase).toBe('FAILED');
  expect(s.store.save()).toBe(before);
});
it('native output references use original bindings and effect parameter ownership', async () => {
  const s = await setup();
  await s.turn('创建一个标题', [
    { id: 't', type: 'createText', content: 'Title' },
  ]);
  const id = layers(s)[0]!.id;
  await s.turn('给标题添加模糊并设置半径', [
    {
      id: 'blur',
      type: 'addEffect',
      effect: 'gaussianBlur',
      target: existing(id),
    },
    {
      id: 'radius',
      type: 'editNative',
      tool: 'setEffectParameter',
      target: existing(id),
      args: {
        effectId: { kind: 'stepResult', stepId: 'blur', output: 'effectId' },
        key: 'radius',
        value: 10,
      },
    },
  ]);
  expect(
    layers(s)[0]!.editor?.graph?.nodes.find((n) => n.type === 'gaussianBlur')
      ?.params.radius?.baseValue,
  ).toBe(10);
});
it('native adapter cannot bypass exclusive creation or change tool during repair', async () => {
  const s = await setup();
  const before = saveProject(s.store.commands.getSnapshot());
  s.enqueue([
    {
      id: 'r',
      type: 'createNative',
      tool: 'createLayer',
      args: { kind: 'text' },
    },
  ]);
  await s.core.run('只创建一个文字图层，不要添加其他对象');
  expect(s.core.state?.phase).toBe('FAILED');
  expect(s.store.save()).toBe(before);
  const a = validateIntent({
    goal: 'native',
    actions: [
      {
        id: 'x',
        type: 'editNative',
        tool: 'renameLayer',
        target: existing(crypto.randomUUID()),
        args: { name: 'A' },
      },
    ],
  }).actions[0]!;
  expect(() =>
    validateRepair(a, {
      ...a,
      tool: 'setLayerVisibility',
      args: { visible: false },
    }),
  ).toThrow();
});
it('native destructive effect removal remains review-only and undoable even in direct mode', async () => {
  const s = await setup();
  await s.turn('创建一个标题', [
    { id: 't', type: 'createText', content: 'Title' },
  ]);
  const id = layers(s)[0]!.id;
  await s.turn('给标题添加模糊', [
    {
      id: 'blur',
      type: 'addEffect',
      target: existing(id),
      effect: 'gaussianBlur',
    },
  ]);
  const effectId = layers(s)[0]!.editor!.graph!.nodes.find(
    (n) => n.type === 'gaussianBlur',
  )!.id;
  const before = s.store.save();
  s.core.setEditMode('direct');
  s.enqueue([
    {
      id: 'remove',
      type: 'editNative',
      target: existing(id),
      tool: 'removeEffect',
      args: { effectId },
    },
  ]);
  await s.core.run('移除标题的模糊效果');
  expect(s.core.pending).toBe(true);
  expect(s.store.save()).toBe(before);
  s.core.accept();
  expect(
    layers(s)[0]!.editor?.graph?.nodes.some((n) => n.id === effectId),
  ).toBe(false);
  s.store.undo();
  expect(s.store.save()).toBe(before);
});
it('failed native Undo never reports success or loses the accepted transaction reference', async () => {
  const s = await setup();
  s.core.setEditMode('direct');
  s.enqueue([{ id: 'r', type: 'createShape', shape: 'rectangle' }]);
  await s.core.run('创建一个矩形');
  const before = s.store.save(),
    last = s.core.session.lastAccepted;
  vi.spyOn(s.store.commands, 'undo').mockReturnValue({
    ok: false,
    error: 'Injected Undo refusal',
  });
  await expect(s.core.run('把刚才的修改撤销')).rejects.toThrow('Undo 未完成');
  expect(s.store.save()).toBe(before);
  expect(s.core.session.lastAccepted).toEqual(last);
  expect(s.core.lastOperation).toBe('');
});
it('unique native object types and explicit identities resolve without selection; multiple UUIDs never pick the first silently', async () => {
  const s = await setup();
  await s.turn('创建一个星形', [
    { id: 'star', type: 'createNative', tool: 'createStar', args: {} },
  ]);
  const id = layers(s)[0]!.id;
  expect(
    s.core.session.resolveRequest(
      '把星形移动到中心',
      s.store.commands.getSnapshot(),
      [],
    ).ids,
  ).toEqual([id]);
  expect(
    s.core.session.resolveRequest(
      '修改 ' + id,
      s.store.commands.getSnapshot(),
      [],
    ).ids,
  ).toEqual([id]);
  expect(() =>
    s.core.session.resolveRequest(
      '修改 ' + id + ' 和 ' + crypto.randomUUID(),
      s.store.commands.getSnapshot(),
      [],
    ),
  ).toThrow('多个明确身份');
});
it.each([
  '创建一个梯度渐变的正方形',
  '能不能帮我创建一个图层',
  '请在画布中央绘制一个正方形',
  '做一个科技风标题',
  '请生成一张海报',
  'Create a square with a gradient',
])('unselected creation reaches planning for %s', async (request) => {
  const s = await setup();
  s.core.setEditMode('direct');
  s.enqueue([
    {
      id: 'shape',
      type: 'createShape',
      shape: 'rectangle',
      width: 200,
      height: 200,
    },
    {
      id: 'fill',
      type: 'setFill',
      target: result('shape'),
      color: rgb(1, 0, 0),
      gradient: 'linear',
      endColor: rgb(0, 0, 1),
    },
  ]);
  await s.core.run(request);
  expect(s.calls).toHaveLength(1);
  expect(s.core.state?.phase).toBe('COMPLETED');
  expect(layers(s)).toHaveLength(1);
  expect(layers(s)[0]!.editor?.gradient).toBe('linear');
});
it('unselected effect request finds a unique real layer and does not authorize extra layers', async () => {
  const s = await setup();
  await s.turn('创建一个矩形', [
    { id: 'r', type: 'createShape', shape: 'rectangle' },
  ]);
  const id = layers(s)[0]!.id;
  s.core.setEditMode('direct');
  s.enqueue([
    {
      id: 'blur',
      type: 'addEffect',
      target: existing(id),
      effect: 'gaussianBlur',
    },
  ]);
  await s.core.run('帮我添加一个模糊效果');
  expect(s.core.state?.phase).toBe('COMPLETED');
  expect(layers(s)).toHaveLength(1);
  expect(
    layers(s)[0]!.editor?.graph?.nodes.some((n) => n.type === 'gaussianBlur'),
  ).toBe(true);
  expect(
    s.core.session.resolveRequest(
      '不要创建新图层，给矩形添加模糊效果',
      s.store.commands.getSnapshot(),
      [],
    ).allowCreate,
  ).toBe(false);
});
it('ambiguous effect target still needs clarification; code and shell tools remain rejected', async () => {
  const s = await setup();
  await s.turn('创建两个矩形', [
    { id: 'a', type: 'createShape', shape: 'rectangle' },
    { id: 'b', type: 'createShape', shape: 'rectangle' },
  ]);
  const before = s.store.save(),
    calls = s.calls.length;
  await expect(s.core.run('添加一个模糊效果')).rejects.toThrow('多个候选');
  expect(s.calls).toHaveLength(calls);
  for (const tool of ['writeFile', 'execute_js', 'shell', 'modifySource'])
    expect(() =>
      validateIntent({
        goal: 'unsupported',
        actions: [
          {
            id: 'code',
            type: 'editNative',
            tool,
            target: existing(layers(s)[0]!.id),
            args: { path: 'src/ui/App.tsx', content: 'bad' },
          },
        ],
      }),
    ).toThrow();
  expect(s.store.save()).toBe(before);
});
