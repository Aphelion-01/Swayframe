// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import {
  parseModel,
  normalizeModel,
  importModelFiles,
} from '../src/importers/model-import';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  activeComposition,
  createLayer,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
import { projectedModel } from '../src/renderers/model-mesh';
import { identity4 } from '../src/core/perspective';
const bytes = (text: string) => {
  const raw = new TextEncoder().encode(text),
    buffer = new ArrayBuffer(raw.byteLength);
  new Uint8Array(buffer).set(raw);
  return buffer;
};
const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
const stl =
  'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle';
const ply =
  'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n';
function gltf() {
  const buffer = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer;
  const data = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  };
  return { data, buffer };
}
function glb() {
  const { data, buffer } = gltf(),
    json = JSON.stringify(data),
    padded = json + ' '.repeat((4 - (json.length % 4)) % 4),
    out = new ArrayBuffer(12 + 8 + padded.length + 8 + buffer.byteLength),
    view = new DataView(out);
  [0x46546c67, 2, out.byteLength, padded.length, 0x4e4f534a].forEach((n, i) =>
    view.setUint32(i * 4, n, true),
  );
  new Uint8Array(out, 20, padded.length).set(new TextEncoder().encode(padded));
  view.setUint32(20 + padded.length, buffer.byteLength, true);
  view.setUint32(24 + padded.length, 0x004e4942, true);
  new Uint8Array(out, 28 + padded.length).set(new Uint8Array(buffer));
  return out;
}
function threeDS() {
  const chunk = (id: number, data: Uint8Array) => {
    const result = new Uint8Array(data.length + 6);
    const v = new DataView(result.buffer);
    v.setUint16(0, id, true);
    v.setUint32(2, result.length, true);
    result.set(data, 6);
    return result;
  };
  const join = (...parts: Uint8Array[]) => {
    const result = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      result.set(p, offset);
      offset += p.length;
    }
    return result;
  };
  const vertices = new Uint8Array(38),
    v = new DataView(vertices.buffer);
  v.setUint16(0, 3, true);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) =>
    v.setFloat32(2 + i * 4, n, true),
  );
  const faces = new Uint8Array(10),
    f = new DataView(faces.buffer);
  [1, 0, 1, 2, 0].forEach((n, i) => f.setUint16(i * 2, n, true));
  return chunk(
    0x4d4d,
    chunk(
      0x3d3d,
      chunk(
        0x4000,
        join(
          new TextEncoder().encode('triangle\0'),
          chunk(0x4100, join(chunk(0x4110, vertices), chunk(0x4120, faces))),
        ),
      ),
    ),
  ).buffer;
}
const dae = `<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><up_axis>Y_UP</up_axis></asset><library_geometries><geometry id="g"><mesh><source id="p"><float_array id="pa" count="9">0 0 0 1 0 0 0 1 0</float_array><technique_common><accessor source="#pa" count="3" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="v"><input semantic="POSITION" source="#p"/></vertices><triangles count="1"><input semantic="VERTEX" source="#v" offset="0"/><p>0 1 2</p></triangles></mesh></geometry></library_geometries><library_visual_scenes><visual_scene id="s"><node id="n"><instance_geometry url="#g"/></node></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#s"/></scene></COLLADA>`;
it.each([
  ['obj', () => bytes(obj)],
  ['stl', () => bytes(stl)],
  ['ply', () => bytes(ply)],
  ['dae', () => bytes(dae)],
  ['3ds', threeDS],
  ['glb', glb],
  [
    'gltf',
    () => {
      const { data, buffer } = gltf();
      return bytes(
        JSON.stringify({
          ...data,
          buffers: [
            {
              byteLength: 36,
              uri:
                'data:application/octet-stream;base64,' +
                Buffer.from(buffer).toString('base64'),
            },
          ],
        }),
      );
    },
  ],
  [
    'fbx',
    () => {
      const b = readFileSync('tests/fixtures/models/RotationTest.fbx');
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
  ],
] as const)('实际解析 %s 并生成可投影静态网格', async (format, make) => {
  const mesh = await parseModel(make(), `fixture.${format}`);
  expect(mesh.vertices.length).toBeGreaterThanOrEqual(9);
  expect(mesh.vertices.every(Number.isFinite)).toBe(true);
  expect(mesh.colors).toHaveLength(mesh.vertices.length / 3);
  expect(Math.max(...mesh.vertices.map(Math.abs))).toBeLessThanOrEqual(120.001);
  expect(
    projectedModel(mesh, identity4, {
      position: [0, 0, -1000],
      rotation: [0, 0, 0],
      zoom: 1000,
      width: 1920,
      height: 1080,
    }).length,
  ).toBeGreaterThan(0);
});
it('导入事务可撤销，模型保存重开保留几何；类型错误和缺失依赖明确拒绝', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:fixture';
      static revokeObjectURL = vi.fn();
    },
  );
  const store = new EditorStore(createDefaultProject());
  await importModelFiles(store, [new File([obj], 'triangle.obj')]);
  const project = store.getSnapshot().project;
  expect(project.assets).toHaveLength(1);
  expect(activeComposition(project).layers[0]?.type).toBe('model');
  expect(loadProject(saveProject(project))).toEqual(project);
  store.undo();
  expect(store.getSnapshot().project.assets).toHaveLength(0);
  store.redo();
  expect(store.getSnapshot().project).toEqual(project);
  const image = createLayer('image', { assetId: project.assets[0]!.id });
  expect(() =>
    saveProject({
      ...project,
      compositions: [{ ...activeComposition(project), layers: [image] }],
    }),
  ).toThrow('类型不匹配');
  await expect(
    parseModel(bytes('mtllib missing.mtl\n' + obj), 'mesh.obj'),
  ).rejects.toThrow('缺少材质');
  await expect(parseModel(bytes('{}'), 'bad.blend')).rejects.toThrow('不支持');
  vi.unstubAllGlobals();
});
it('几何数量和空几何的边界在写入工程前拒绝', () => {
  expect(() =>
    normalizeModel(
      new Mesh(
        new BoxGeometry(1, 1, 1, 100, 100, 100),
        new MeshBasicMaterial(),
      ),
      'obj',
    ),
  ).toThrow('20,000');
});
it('glTF 的远端依赖在网络请求前拒绝', async () => {
  const { data } = gltf(),
    request = vi.spyOn(globalThis, 'fetch');
  const source = {
    ...data,
    buffers: [{ byteLength: 36, uri: 'https://example.invalid/private.bin' }],
  };
  await expect(
    parseModel(bytes(JSON.stringify(source)), 'remote.gltf'),
  ).rejects.toThrow('缺少模型依赖文件');
  expect(request).not.toHaveBeenCalled();
  request.mockRestore();
});
it('批量模型中一个解析失败时，不留下部分素材或图层', async () => {
  const revoke = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:batch-fixture';
      static revokeObjectURL = revoke;
    },
  );
  const store = new EditorStore(createDefaultProject()),
    before = store.getSnapshot().project;
  await expect(
    importModelFiles(store, [
      new File([obj], 'good.obj'),
      new File(['invalid geometry'], 'broken.obj'),
    ]),
  ).rejects.toThrow('模型没有有效的三角形几何');
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
  expect(revoke).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});
