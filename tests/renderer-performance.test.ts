import { expect, it } from 'vitest';
import { createLayer, createComposition } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
it('二维快照保留真实父级矩阵和动画，只有三维图层及其祖先计算 world3D', () => {
  const parent = createLayer('null', { position: { x: 960, y: 540 } });
  const child = createLayer('rectangle', { position: { x: 100, y: 0 } });
  const nested = {
    ...child,
    editor: { ...child.editor!, parentId: parent.id },
  };
  const independent = createLayer('rectangle');
  const c = { ...createComposition(), layers: [parent, nested, independent] };
  const flat = createRenderSnapshot(c, 0, []);
  expect(flat.layers.every((l) => l.world3D === undefined)).toBe(true);
  expect(flat.layers[1]!.position).toEqual({ x: 1060, y: 540 });
  const projected = createRenderSnapshot(
    {
      ...c,
      layers: [
        parent,
        { ...nested, editor: { ...nested.editor, is3D: true } },
        independent,
      ],
    },
    0,
    [],
  );
  const plane = projected.layers.find((l) => l.source.id === child.id)!;
  expect(
    projected.layers.find((l) => l.source.id === parent.id)!.world3D,
  ).toBeDefined();
  expect(
    projected.layers.find((l) => l.source.id === independent.id)!.world3D,
  ).toBeUndefined();
  expect(plane.quad).toHaveLength(4);
  const center = plane.quad!.reduce(
    (a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }),
    { x: 0, y: 0 },
  );
  expect(center.x).toBeCloseTo(1060);
  expect(center.y).toBeCloseTo(540);
});
it('父级循环仍明确拒绝，三维依赖闭包不会死循环', () => {
  const a = createLayer('rectangle'),
    b = createLayer('rectangle');
  const layers = [
    { ...a, editor: { ...a.editor!, parentId: b.id, is3D: true } },
    { ...b, editor: { ...b.editor!, parentId: a.id } },
  ];
  expect(() =>
    createRenderSnapshot({ ...createComposition(), layers }, 0, []),
  ).toThrow('Parent cycle');
});
it('选择变化复用冻结场景的求值层数组，仍返回正确的选区', async () => {
  const { CommandSystem } = await import('../src/core/command-system');
  const { createDefaultProject } = await import('../src/core/project-model');
  const p = createDefaultProject();
  const project = new CommandSystem({
    ...p,
    compositions: p.compositions.map((c) => ({
      ...c,
      layers: [createLayer('rectangle')],
    })),
  }).getSnapshot();
  const c = project.compositions[0]!;
  const first = createRenderSnapshot(c, 0, [], undefined, project);
  const selected = createRenderSnapshot(
    c,
    0,
    [c.layers[0]!.id],
    undefined,
    project,
  );
  expect(selected.layers).toBe(first.layers);
  expect(selected.selection).toEqual([c.layers[0]!.id]);
  expect(first.selection).toEqual([]);
});
