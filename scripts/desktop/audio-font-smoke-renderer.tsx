import { createRoot } from 'react-dom/client';
import { EditorStore } from '../../src/ui/editor-store';
import { MediaPlayback } from '../../src/ui/MediaPlayback';
import { Inspector } from '../../src/ui/Inspector';
import { linkedAsset } from '../../src/desktop/asset-service';
import { command } from '../../src/core/command-system';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../../src/core/project-model';
import '../../src/ui/base.css';
import '../../src/ui/design-tokens.css';
import '../../src/ui/editor-theme.css';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const originalAudio = window.Audio;
const elements: HTMLAudioElement[] = [];
window.Audio = function (src?: string) {
  const a = new originalAudio(src);
  a.muted = true;
  elements.push(a);
  return a;
} as typeof Audio;
const root = createRoot(document.getElementById('root')!);
async function run() {
  const api = window.swayframe!.desktop;
  const families = await api.fonts!.list();
  const inputs = await api.assets.importFiles(
    JSON.parse(document.body.dataset.files!),
  );
  const results = [];
  for (const input of inputs) {
    const store = new EditorStore(createDefaultProject());
    const asset = await linkedAsset(input);
    const c = activeComposition(store.getSnapshot().project);
    const layer = createLayer('audio', { assetId: asset.id });
    const imported = store.run('导入链接素材', [
      command({ type: 'asset.add', asset }),
      command({ type: 'layer.create', compositionId: c.id, layer }),
    ]);
    root.render(<MediaPlayback store={store} />);
    await pause(100);
    const audio = elements.at(-1)!;
    for (let i = 0; i < 100 && audio.readyState < 2 && !audio.error; i++)
      await pause(100);
    store.setPlaying(true);
    await pause(600);
    const playing = !audio.paused && audio.currentTime > 0;
    const target = Math.min(2, (asset.media?.duration ?? 5) / 2);
    store.setTime(target);
    const seekImmediate = audio.currentTime;
    await pause(500);
    const seek =
      audio.currentTime >= target - 0.15 && audio.currentTime < target + 1.5;
    const seekActual = audio.currentTime;
    store.setPlaying(false);
    await pause(100);
    const stopped = audio.paused;
    results.push({
      name: asset.name,
      kind: asset.media?.kind,
      duration: asset.media?.duration,
      imported: imported.ok,
      source: audio.src.split(':')[0],
      playing,
      seek,
      seekImmediate,
      seekActual,
      target,
      storeTime: store.getSnapshot().time,
      stopped,
      error: audio.error?.message ?? null,
      status: store.getSnapshot().status,
    });
    store.undo();
    const undone = store.getSnapshot().project.assets.length === 0;
    store.redo();
    Object.assign(results.at(-1)!, {
      undone,
      redone: store.getSnapshot().project.assets.length === 1,
    });
  }
  const store = new EditorStore(createDefaultProject()),
    c = activeComposition(store.getSnapshot().project),
    layer = createLayer('text');
  store.run('创建文字', [
    command({ type: 'layer.create', compositionId: c.id, layer }),
  ]);
  store.select(layer.id);
  root.render(<Inspector store={store} />);
  await pause(700);
  const options = [
    ...document.querySelectorAll('.system-font-field option'),
  ].map((o) => (o as HTMLOptionElement).value);
  const family = families.find((f) => f === 'PingFang SC') ?? families[0]!;
  store.run('修改字体', [
    command({
      type: 'layer.patch',
      compositionId: c.id,
      layerId: layer.id,
      patch: { fontFamily: family },
    }),
  ]);
  const chosen = (
    activeComposition(store.getSnapshot().project).layers[0] as typeof layer
  ).fontFamily;
  store.undo();
  const undone =
    (activeComposition(store.getSnapshot().project).layers[0] as typeof layer)
      .fontFamily === layer.fontFamily;
  store.redo();
  await pause(100);
  return {
    audio: results,
    fonts: {
      count: families.length,
      listed: options.length,
      hasSystemFamily: options.includes(family),
      chosen,
      undone,
      redone:
        (
          activeComposition(store.getSnapshot().project)
            .layers[0] as typeof layer
        ).fontFamily === family,
    },
    pass:
      results.every(
        (r) =>
          r.imported &&
          r.playing &&
          r.seek &&
          r.stopped &&
          !r.error &&
          r.undone &&
          r.redone,
      ) &&
      options.includes(family) &&
      undone,
  };
}
run()
  .then((result) => {
    (window as unknown as { result: unknown }).result = result;
  })
  .catch((e) => {
    (window as unknown as { result: unknown }).result = {
      pass: false,
      error: String(e),
    };
  });
