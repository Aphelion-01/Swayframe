// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { AgentSnapshotRenderer } from '../src/agent/vision';
import {
  activeComposition,
  createComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { saveProject } from '../src/core/project-io';
import { command } from '../src/core/command-system';
import {
  sessionFixture,
  existing,
  result,
  rgb,
} from './helpers/agent-v2-session-fixture';
import { ConversationSession } from '../src/agent-v2/session';
import type { ChatRequest } from '../src/ai/contracts';
import fs from 'node:fs';
const records: unknown[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  fs.mkdirSync('outputs/agent-v2-7', { recursive: true });
  fs.writeFileSync(
    'outputs/agent-v2-7/session-unit.json',
    JSON.stringify(
      {
        scope:
          'OFFLINE fixture; real editor controller/runtime/commands, jsdom renderer mocked; actual Electron verification separate',
        records,
      },
      null,
      2,
    ) + '\n',
  );
});
async function setup() {
  vi.spyOn(AgentSnapshotRenderer.prototype, 'render').mockResolvedValue({
    image: 'data:image/png;base64,YQ==',
    pixelEvidence: { width: 10, height: 10, foregroundPixels: 1 },
  } as Awaited<ReturnType<AgentSnapshotRenderer['render']>>);
  return sessionFixture();
}
const layers = (s: Awaited<ReturnType<typeof setup>>) =>
  activeComposition(s.store.commands.getSnapshot()).layers;
const create = [
  { id: 'rect', type: 'createShape' as const, shape: 'rectangle' as const },
];
it('S1: five accepted turns preserve exactly three identities, distinct colors, animation, dimensions, undo and reload', async () => {
  const s = await setup();
  await s.turn(
    '创建三个矩形，红绿蓝',
    [0, 1, 2].flatMap((n) => [
      {
        id: 'r' + n,
        type: 'createShape' as const,
        shape: 'rectangle' as const,
      },
      {
        id: 'f' + n,
        type: 'setFill' as const,
        target: result('r' + n),
        color: rgb(n === 0 ? 1 : 0, n === 1 ? 1 : 0, n === 2 ? 1 : 0),
      },
    ]),
  );
  const ids = s.core.session.references.map((r) => r.id);
  await s.turn('把第二个矩形改成紫色', [
    {
      id: 'purple',
      type: 'setFill',
      target: existing(ids[1]!),
      color: rgb(0.5, 0, 0.5),
    },
  ]);
  await s.turn(
    '给第二个矩形添加两秒位置动画',
    [0, 2].map((time) => ({
      id: 'k' + time,
      type: 'addKeyframe',
      target: existing(ids[1]!),
      property: 'position',
      time,
      value: { x: 100 + time * 200, y: 300 },
      interpolation: { type: 'linear' as const },
    })),
  );
  await s.turn('把第三个矩形移到中心', [
    {
      id: 'center',
      type: 'setProperty',
      target: existing(ids[2]!),
      property: 'position',
      value: { x: 960, y: 540 },
    },
  ]);
  await s.turn('修改第一个矩形宽高', [
    {
      id: 'size',
      type: 'setDimensions',
      target: existing(ids[0]!),
      width: 400,
      height: 200,
    },
  ]);
  expect(layers(s).map((l) => l.id)).toEqual(ids);
  expect(layers(s)[0]!.width).toBe(400);
  expect(layers(s)[1]!.editor?.properties.fill?.baseValue).toEqual([
    0.5, 0, 0.5, 1,
  ]);
  expect(layers(s)[1]!.transform.position.keyframes).toHaveLength(2);
  expect(s.store.commands.undoStack).toHaveLength(5);
  const saved = saveProject(s.store.commands.getSnapshot());
  s.store.undo();
  expect(layers(s)[0]!.width).not.toBe(400);
  s.store.redo();
  expect(saveProject(s.store.commands.getSnapshot())).toBe(saved);
  expect(s.store.load(saved)).toBe(true);
  expect(layers(s).map((l) => l.id)).toEqual(ids);
  records.push({
    id: 'S1',
    turns: 5,
    pass: true,
    layers: 3,
    commits: 5,
    undoRedo: true,
    reload: true,
  });
});
it('S2: title font/size, subtitle, subsequent title move and opacity retain actual text identity', async () => {
  const s = await setup();
  await s.turn('创建Cubic标题', [
    { id: 'title', type: 'createText', content: 'Cubic' },
  ]);
  const id = layers(s)[0]!.id;
  await s.turn('修改标题字体和字号', [
    { id: 'font', type: 'setFont', target: existing(id), fontFamily: 'serif' },
    {
      id: 'size',
      type: 'setProperty',
      target: existing(id),
      property: 'fontSize',
      value: 90,
    },
  ]);
  await s.turn('添加中文副标题', [
    { id: 'sub', type: 'createText', content: '立方渐变' },
  ]);
  await s.turn('移动标题', [
    {
      id: 'move',
      type: 'setProperty',
      target: existing(id),
      property: 'position',
      value: { x: 960, y: 400 },
    },
  ]);
  await s.turn(
    '给标题添加透明度动画',
    [0, 2].map((time) => ({
      id: 'o' + time,
      type: 'addKeyframe',
      target: existing(id),
      property: 'opacity',
      time,
      value: time ? 1 : 0,
    })),
  );
  expect(layers(s)).toHaveLength(2);
  expect(layers(s)[0]).toMatchObject({
    type: 'text',
    text: 'Cubic',
    fontFamily: 'serif',
  });
  expect(layers(s)[0]!.transform.opacity.keyframes).toHaveLength(2);
  expect(layers(s)[0]!.editor?.properties.fontSize?.baseValue).toBe(90);
  const latestContext = JSON.parse(
    s.calls.at(-1)!.messages[0]!.content.split('\n').at(-1)!,
  ).context.session;
  expect(
    latestContext.reads.relevantScene[0].properties.find(
      (p: { path: string }) => p.path === 'editor.properties.fontSize',
    ).value,
  ).toBe(90);
  records.push({ id: 'S2', turns: 5, pass: true, duplicateTitle: false });
});
it('S3: GUI movement/fill and current selection are refreshed before the next provider request', async () => {
  const s = await setup();
  await s.turn('创建渐变矩形', [
    ...create,
    {
      id: 'fill',
      type: 'setFill',
      target: result('rect'),
      color: rgb(0, 0, 1),
      gradient: 'radial',
      endColor: rgb(0, 0, 0),
    },
  ]);
  const l = layers(s)[0]!;
  s.store.run('GUI移动', [
    command({
      type: 'property.setBase',
      propertyId: l.transform.position.id,
      value: { x: 500, y: 400 },
    }),
  ]);
  await s.turn('把刚才移动的矩形继续向右移动300像素', [
    {
      id: 'continue',
      type: 'setProperty',
      target: existing(l.id),
      property: 'position',
      value: { x: 800, y: 400 },
    },
  ]);
  const request = s.calls.at(-1)!;
  const context = JSON.parse(request.messages[0]!.content.split('\n').at(-1)!)
    .context.session;
  expect(
    context.reads.relevantScene[0].properties.find(
      (p: { path: string }) => p.path === 'transform.position',
    ).value,
  ).toEqual({ x: 500, y: 400 });
  expect(context.reads.relevantScene[0].gradient).toBe('radial');
  expect(
    context.reads.relevantScene[0].properties.find(
      (p: { path: string }) => p.path === 'editor.properties.fill',
    ).value,
  ).toBeDefined();
  s.store.run('GUI填充', [
    command({
      type: 'property.setBase',
      propertyId: l.editor!.properties.fill!.id,
      value: [1, 0, 0, 1],
    }),
  ]);
  s.store.select(l.id);
  await s.turn('把当前选中图层透明度改成0.5', [
    {
      id: 'opacity',
      type: 'setProperty',
      target: { kind: 'selection' },
      property: 'opacity',
      value: 0.5,
    },
  ]);
  expect(layers(s)[0]!.transform.position.baseValue).toEqual({
    x: 800,
    y: 400,
  });
  expect(layers(s)[0]!.editor?.properties.fill?.baseValue).toEqual([
    1, 0, 0, 1,
  ]);
  records.push({
    id: 'S3',
    pass: true,
    guiRetained: true,
    latestContext: true,
  });
});
it('S4: deletion produces a stale-reference error before transport and never recreates a missing target', async () => {
  const s = await setup();
  await s.turn('创建矩形', create);
  const id = layers(s)[0]!.id;
  s.store.run('删除', [
    command({
      type: 'layer.delete',
      compositionId: s.store.commands.getSnapshot().activeCompositionId,
      layerId: id,
    }),
  ]);
  await expect(s.core.run('把刚才的矩形改成蓝色')).rejects.toThrow(/删除|撤销/);
  expect(s.calls).toHaveLength(1);
  expect(layers(s)).toHaveLength(0);
  records.push({
    id: 'S4',
    pass: true,
    staleDetected: true,
    unintendedWrites: 0,
  });
});
it('S5: deterministic animation removal commits separately and preserves prior gradient/title', async () => {
  const s = await setup();
  await s.turn('创建渐变背景矩形', [
    ...create,
    {
      id: 'g',
      type: 'setFill',
      target: result('rect'),
      color: rgb(0, 0, 1),
      gradient: 'radial',
    },
  ]);
  await s.turn('添加标题', [{ id: 't', type: 'createText', content: 'Cubic' }]);
  const id = layers(s)[1]!.id;
  await s.turn(
    '给标题添加两秒透明度动画',
    [0, 2].map((time) => ({
      id: 'o' + time,
      type: 'addKeyframe',
      target: existing(id),
      property: 'opacity',
      time,
      value: time ? 1 : 0,
    })),
  );
  await s.core.run('撤销刚才的动画，保留渐变');
  expect(s.core.pending).toBe(true);
  s.core.accept();
  expect(s.calls).toHaveLength(3);
  expect(layers(s)).toHaveLength(2);
  expect(layers(s)[0]!.editor?.gradient).toBe('radial');
  expect(layers(s)[1]!.transform.opacity.keyframes).toHaveLength(0);
  s.store.undo();
  expect(layers(s)[1]!.transform.opacity.keyframes).toHaveLength(2);
  records.push({
    id: 'S5',
    pass: true,
    scopedInverse: true,
    extraModelRequests: 0,
  });
});
it('S6: saved/reloaded objects are revalidated, including in a fresh session without temporary result IDs', async () => {
  const s = await setup();
  await s.turn('创建矩形', create);
  const id = layers(s)[0]!.id,
    saved = saveProject(s.store.commands.getSnapshot());
  expect(s.store.load(saved)).toBe(true);
  s.core.newSession();
  await s.turn('把矩形改为蓝色', [
    { id: 'blue', type: 'setFill', target: existing(id), color: rgb(0, 0, 1) },
  ]);
  expect(layers(s)[0]!.id).toBe(id);
  expect(layers(s)).toHaveLength(1);
  records.push({ id: 'S6', pass: true, temporaryBindingsReused: false });
});
it('S7: rejected and cancelled drafts never populate committed session references', async () => {
  const s = await setup();
  s.enqueue([{ id: 't', type: 'createText', content: 'Rejected' }]);
  await s.core.run('创建标题');
  s.core.reject();
  await expect(s.core.run('把刚才那个标题改为蓝色')).rejects.toThrow(/目标/);
  expect(layers(s)).toHaveLength(0);
  expect(s.core.session.references).toHaveLength(0);
  s.enqueue(create);
  await s.core.run('创建矩形');
  s.core.cancel();
  expect(s.core.session.references).toHaveLength(0);
  expect(layers(s)).toHaveLength(0);
  records.push({
    id: 'S7',
    pass: true,
    rejectedReferences: 0,
    cancelledReferences: 0,
  });
});
it('S8: undo-invalidated ordinal is detected; redo restores the same valid object', async () => {
  const s = await setup();
  await s.turn('创建矩形', create);
  await s.turn('再创建矩形', create);
  const id = layers(s)[1]!.id;
  s.store.undo();
  await expect(s.core.run('把第二个矩形改为蓝色')).rejects.toThrow(/删除|撤销/);
  expect(layers(s)).toHaveLength(1);
  s.store.redo();
  await s.turn('把第二个矩形改为蓝色', [
    { id: 'f', type: 'setFill', target: existing(id), color: rgb(0, 0, 1) },
  ]);
  expect(layers(s)[1]!.id).toBe(id);
  records.push({
    id: 'S8',
    pass: true,
    undoInvalidation: true,
    redoIdentity: true,
  });
});
it('does not guess by duplicate names; selection resolves ambiguity, locks and foreign compositions reject', () => {
  const base = createDefaultProject(),
    a = createLayer('rectangle', { name: 'Same' }),
    b = createLayer('rectangle', { name: 'Same' }),
    c = activeComposition(base),
    p = { ...base, compositions: [{ ...c, layers: [a, b] }] },
    session = new ConversationSession(p);
  expect(() => session.resolveRequest('把矩形改蓝色', p, [])).toThrow('多个');
  expect(session.resolveRequest('把矩形改蓝色', p, [b.id]).ids).toEqual([b.id]);
  const locked = {
    ...p,
    compositions: [{ ...c, layers: [{ ...a, locked: true }, b] }],
  };
  expect(() => session.resolveRequest('第一个矩形改蓝色', locked, [])).toThrow(
    '锁定',
  );
  const other = createComposition();
  expect(() =>
    session.validate(a.id, {
      ...p,
      activeCompositionId: other.id,
      compositions: [...p.compositions, other],
    }),
  ).toThrow('其他合成');
});
it('duplicate submissions and double accepts cannot create duplicate objects or commits', async () => {
  const s = await setup();
  s.enqueue(create);
  const first = s.core.run('创建矩形');
  await expect(s.core.run('创建矩形')).rejects.toThrow('尚未结束');
  await first;
  s.core.accept();
  expect(() => s.core.accept()).toThrow('没有可接受');
  expect(layers(s)).toHaveLength(1);
  expect(s.store.commands.undoStack).toHaveLength(1);
  s.core.cancel();
  expect(s.core.state?.phase).toBe('COMPLETED');
});
it.each(['cancel', 'selection', 'project', 'composition', 'gui'] as const)(
  'late response after %s cannot mutate the formal Scene or committed references',
  async (kind) => {
    const s = await setup();
    let release!: (r: Awaited<ReturnType<(typeof s.queued)[number]>>) => void;
    s.queued.push(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const run = s.core.run('创建矩形');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    if (kind === 'cancel') s.core.cancel();
    else if (kind === 'selection') s.store.select(crypto.randomUUID());
    else if (kind === 'project')
      s.store.load(saveProject(createDefaultProject()));
    else if (kind === 'composition') {
      const comp = createComposition();
      s.store.run('切换', [
        command({ type: 'composition.add', composition: comp }),
        command({ type: 'project.activate', compositionId: comp.id }),
      ]);
    } else
      s.store.run('GUI创建', [
        command({
          type: 'layer.create',
          compositionId: s.store.commands.getSnapshot().activeCompositionId,
          layer: createLayer('ellipse'),
        }),
      ]);
    const expected = saveProject(s.store.commands.getSnapshot());
    release({
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'late',
          name: 'submitIntent',
          arguments: { goal: 'late', actions: create },
        },
      ],
    });
    await run;
    expect(saveProject(s.store.commands.getSnapshot())).toBe(expected);
    expect(s.core.session.references).toHaveLength(0);
    expect(s.core.state?.phase).toBe('CANCELLED');
  },
);
it('wrong existing target, unsupported actions and failed commit never become accepted session references', async () => {
  const s = await setup();
  await s.turn('创建两个矩形', [...create, { ...create[0]!, id: 'second' }]);
  const ids = layers(s).map((l) => l.id);
  s.enqueue([
    {
      id: 'wrong',
      type: 'setFill',
      target: existing(ids[1]!),
      color: rgb(1, 0, 0),
    },
  ]);
  await s.core.run('把第一个矩形改为红色');
  expect(s.core.state?.phase).toBe('FAILED');
  expect(s.store.commands.undoStack).toHaveLength(1);
  s.enqueue([
    {
      id: 'right',
      type: 'setFill',
      target: existing(ids[0]!),
      color: rgb(1, 0, 0),
    },
  ]);
  await s.core.run('把第一个矩形改为红色');
  const old = [...s.core.session.references];
  vi.spyOn(s.store.commands, 'executeTransaction').mockReturnValue({
    ok: false,
    error: 'Injected commit rejection',
  });
  expect(() => s.core.accept()).toThrow('Injected');
  expect(s.core.session.references).toEqual(old);
  expect(s.core.state?.phase).toBe('FAILED');
});
it('undo intent stops after an unrelated GUI history entry and V1 cannot run while V2 is selected', async () => {
  const s = await setup();
  await s.turn('创建矩形', create);
  const l = layers(s)[0]!;
  await s.turn('给矩形添加位置动画', [
    {
      id: 'k',
      type: 'addKeyframe',
      target: existing(l.id),
      property: 'position',
      time: 1,
      value: { x: 500, y: 500 },
    },
  ]);
  s.store.run('GUI位置', [
    command({
      type: 'property.setBase',
      propertyId: l.transform.opacity.id,
      value: 0.6,
    }),
  ]);
  const before = saveProject(s.store.commands.getSnapshot());
  await expect(s.core.run('撤销刚才动画，保留渐变')).rejects.toThrow('历史');
  expect(saveProject(s.store.commands.getSnapshot())).toBe(before);
  expect(() => s.native.agent.run('create')).toThrow('不会同时');
  s.core.select('legacy-v1');
  expect(s.core.running).toBe(false);
});
it('bounded context and diagnostic omit user request, property values, images and credentials', async () => {
  const s = await setup();
  await s.turn('创建Cubic标题', [
    { id: 't', type: 'createText', content: 'SecretWords' },
  ]);
  const d = s.core.diagnostic();
  expect(d).not.toContain('SecretWords');
  expect(d).not.toContain('创建Cubic');
  expect(d).not.toContain('data:image');
  expect(d).not.toContain('apiKey');
  expect(JSON.parse(d).sessionId).toBe(s.core.session.id);
  const req: ChatRequest = s.calls[0]!;
  expect(req.messages.every((m) => !m.images?.length)).toBe(true);
});
