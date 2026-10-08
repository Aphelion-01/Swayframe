import {
  Box3,
  Color,
  LoadingManager,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Object3D,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { saveProject } from '../core/project-io';
import { newId } from '../core/core-types';
import {
  activeComposition,
  createLayer,
  type Asset,
  type ModelGeometry,
} from '../core/project-model';
import { command } from '../core/command-system';
import type { EditorStore } from '../ui/editor-store';
export const modelExtensions = [
  'glb',
  'gltf',
  'fbx',
  'obj',
  'stl',
  'ply',
  'dae',
  '3ds',
] as const;
export const modelAccept = modelExtensions.map((e) => '.' + e).join(',');
export const isModelFile = (name: string) =>
  modelExtensions.some((e) => name.toLowerCase().endsWith('.' + e));
/** Bake static geometry and material colors into the project; no network or external references survive. */
export function normalizeModel(root: Object3D, format: string): ModelGeometry {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root),
    center = box.getCenter(new Vector3()),
    size = box.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= 0)
    throw Error('模型没有有效的三角形几何');
  const vertices: number[] = [],
    colors: number[] = [],
    p = new Vector3();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh<BufferGeometry, Material | Material[]>,
      geometry = mesh.geometry,
      positions = geometry.getAttribute('position'),
      index = geometry.index;
    if (!positions) return;
    const count = index?.count ?? positions.count;
    for (let i = 0; i + 2 < count; i += 3) {
      if (vertices.length >= 180000)
        throw Error('模型超过 20,000 个三角形，请先减面后导入');
      const group = geometry.groups.find(
          (g) => i >= g.start && i < g.start + g.count,
        ),
        material = Array.isArray(mesh.material)
          ? mesh.material[group?.materialIndex ?? 0]
          : mesh.material;
      const color =
        material && 'color' in material
          ? (material.color as Color)
          : new Color(0.6, 0.65, 0.75);
      colors.push(
        ...color
          .clone()
          .convertLinearToSRGB()
          .toArray()
          .map((n) => Math.max(0, Math.min(1, n))),
      );
      for (let k = 0; k < 3; k++) {
        p.fromBufferAttribute(positions, index ? index.getX(i + k) : i + k)
          .applyMatrix4(mesh.matrixWorld)
          .sub(center)
          .multiplyScalar(240 / extent);
        vertices.push(...[p.x, -p.y, -p.z].map((n) => (n === 0 ? 0 : n)));
      }
    }
  });
  if (!vertices.length || !vertices.every(Number.isFinite))
    throw Error('模型几何无效');
  return { vertices, colors, format };
}
export async function parseModel(
  buffer: ArrayBuffer,
  name: string,
  resources: ReadonlyMap<string, string> = new Map(),
): Promise<ModelGeometry> {
  const ext = name.split('.').pop()!.toLowerCase(),
    manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (/^data:/.test(url)) return url;
    const key = decodeURIComponent(url)
      .replace(/^\.\//, '')
      .replaceAll('\\', '/');
    const local = resources.get(key) ?? resources.get(key.split('/').pop()!);
    if (!local)
      throw Error(
        `缺少模型依赖文件：${key}。请同时选择模型、bin、材质和纹理文件`,
      );
    return local;
  });
  let root: Object3D;
  const text = () => new TextDecoder().decode(buffer);
  switch (ext) {
    case 'glb':
    case 'gltf': {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      root = (
        await new GLTFLoader(manager).parseAsync(
          ext === 'gltf' ? text() : buffer,
          '',
        )
      ).scene;
      break;
    }
    case 'fbx': {
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      root = new FBXLoader(manager).parse(buffer, '');
      break;
    }
    case 'obj': {
      const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
      const loader = new OBJLoader(manager);
      const mtl = /^mtllib\s+(.+)$/m.exec(text())?.[1]?.trim();
      if (mtl) {
        const uri = resources.get(mtl);
        if (!uri) throw Error(`缺少材质文件：${mtl}`);
        const { MTLLoader } = await import('three/addons/loaders/MTLLoader.js');
        const materials = new MTLLoader(manager).parse(
          await (await fetch(uri)).text(),
          '',
        );
        materials.preload();
        loader.setMaterials(materials);
      }
      root = loader.parse(text());
      break;
    }
    case 'stl': {
      const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
      root = new Mesh(
        new STLLoader(manager).parse(buffer),
        new MeshBasicMaterial({ color: 0x99aabb }),
      );
      break;
    }
    case 'ply': {
      const { PLYLoader } = await import('three/addons/loaders/PLYLoader.js');
      const geometry = new PLYLoader(manager).parse(buffer);
      if (!geometry.index?.count) {
        geometry.dispose();
        throw Error('PLY 点云暂不支持，请导出为带三角面的网格');
      }
      root = new Mesh(geometry, new MeshBasicMaterial({ color: 0x99aabb }));
      break;
    }
    case 'dae': {
      const { ColladaLoader } =
        await import('three/addons/loaders/ColladaLoader.js');
      root = new ColladaLoader(manager).parse(text(), '')!.scene;
      break;
    }
    case '3ds': {
      const { TDSLoader } = await import('three/addons/loaders/TDSLoader.js');
      root = new TDSLoader(manager).parse(buffer, '');
      break;
    }
    default:
      throw Error(
        '不支持此格式。请使用 GLB/glTF、FBX、OBJ、STL、PLY、DAE 或 3DS；BLEND/C4D/MAX 请先导出为 GLB 或 FBX',
      );
  }
  try {
    return normalizeModel(root, ext);
  } finally {
    root.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const value of Object.values(m))
            if (value && typeof value === 'object' && 'isTexture' in value)
              (value as Texture).dispose();
          m.dispose();
        }
      }
    });
  }
}
const fileBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(Error('模型文件读取失败'));
    r.readAsArrayBuffer(file);
  });
export async function importModelFiles(
  store: EditorStore,
  files: readonly File[],
  addLayer = true,
) {
  if (files.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024)
    throw Error('本次模型及依赖文件总大小不能超过 100 MB');
  const models = files.filter((f) => isModelFile(f.name));
  if (!models.length) throw Error('请选择支持的模型文件');
  const resources = new Map<string, string>(),
    urls: string[] = [];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    urls.push(url);
    resources.set(file.name, url);
    resources.set(file.webkitRelativePath || file.name, url);
  }
  const revision = store.getSnapshot().project,
    c = activeComposition(revision);
  try {
    store.setStatus('正在解析三维模型…');
    const assets: Asset[] = [];
    for (const file of models) {
      const mesh = await parseModel(
        await fileBuffer(file),
        file.name,
        resources,
      );
      assets.push({
        id: newId(),
        name: file.name,
        mimeType: 'model/x-swayframe-mesh',
        dataUrl: '',
        mesh,
      });
    }
    if (store.getSnapshot().project !== revision)
      throw Error('解析期间工程已改变，请重新导入');
    const layers = addLayer
      ? assets.map((a) =>
          createLayer('model', {
            width: 240,
            height: 240,
            assetId: a.id,
            name: a.name,
            position: { x: c.width / 2, y: c.height / 2 },
          }),
        )
      : [];
    // Reject projects that would be impossible to save, before the atomic import transaction.
    saveProject({
      ...revision,
      assets: [...revision.assets, ...assets],
      compositions: revision.compositions.map((comp) =>
        comp.id === c.id
          ? { ...comp, layers: [...comp.layers, ...layers] }
          : comp,
      ),
    });
    const result = store.run('导入三维模型', [
      ...assets.map((asset) => command({ type: 'asset.add', asset })),
      ...layers.map((layer) =>
        command({ type: 'layer.create', compositionId: c.id, layer }),
      ),
    ]);
    if (!result.ok) throw Error('模型导入事务未通过校验');
    if (layers[0]) store.select(layers[0].id);
    store.setStatus(
      `已导入 ${assets.length} 个静态模型（几何与材质颜色；不含纹理、骨骼动画）`,
    );
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
