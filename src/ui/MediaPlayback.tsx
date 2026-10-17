import { audioPreviewUrl } from '../importers/audio-preview';
import { useEffect, useRef } from 'react';
import { activeComposition } from '../core/project-model';
import type { EditorStore } from './editor-store';
/** Playback follows the one editor clock; audio elements never own composition time. */
export function MediaPlayback({ store }: { store: EditorStore }) {
  const elements = useRef(new Map<string, HTMLAudioElement>());
  useEffect(() => {
    const pending = new Set<string>();
    const failed = new Set<string>();
    let wasPlaying = false;
    let disposed = false;
    const sources = new Map<string, { original: string; url: string }>();
    const loading = new Set<string>();
    const update = () => {
      const v = store.getSnapshot(),
        c = activeComposition(v.project);
      if (v.playing && !wasPlaying) failed.clear();
      wasPlaying = v.playing;
      const live = new Set<string>();
      for (const layer of c.layers) {
        if (layer.type !== 'audio' && layer.type !== 'video') continue;
        const asset = v.project.assets.find((a) => a.id === layer.assetId);
        if (!asset) continue;
        live.add(layer.id);
        let source = sources.get(layer.id);
        if (
          asset.mimeType === 'audio/aiff' &&
          source?.original !== asset.dataUrl
        ) {
          if (!loading.has(layer.id) && !failed.has(layer.id)) {
            loading.add(layer.id);
            void audioPreviewUrl(asset.dataUrl, asset.mimeType)
              .then((url) => {
                if (
                  disposed ||
                  !store
                    .getSnapshot()
                    .project.assets.some((a) => a.dataUrl === asset.dataUrl)
                ) {
                  URL.revokeObjectURL(url);
                  return;
                }
                const old = sources.get(layer.id);
                if (old?.url.startsWith('blob:')) URL.revokeObjectURL(old.url);
                sources.set(layer.id, { original: asset.dataUrl, url });
                update();
              })
              .catch((e) => {
                failed.add(layer.id);
                store.setStatus(String(e), true);
              })
              .finally(() => loading.delete(layer.id));
          }
          continue;
        }
        source = sources.get(layer.id);
        const playbackUrl = source?.url ?? asset.dataUrl;
        let audio = elements.current.get(layer.id);
        if (!audio) {
          audio = new Audio(playbackUrl);
          audio.preload = 'auto';
          audio.addEventListener('error', () =>
            store.setStatus(
              `音轨无法播放：${asset.name}（媒体错误 ${audio?.error?.code ?? '未知'}）。请检查素材是否仍可访问，或重新链接素材。`,
              true,
            ),
          );
          elements.current.set(layer.id, audio);
        }
        if (audio.src !== playbackUrl) audio.src = playbackUrl;
        const time = Math.max(0, v.time - (layer.editor?.startTime ?? 0));
        if (audio.readyState > 0 && Math.abs(audio.currentTime - time) > 0.12)
          audio.currentTime = Math.min(
            time,
            Number.isFinite(audio.duration) ? audio.duration : time,
          );
        const active =
          layer.visible &&
          v.time >= (layer.editor?.inPoint ?? 0) &&
          v.time < (layer.editor?.outPoint ?? c.duration);
        if (v.playing && active) {
          if (audio.paused && !pending.has(layer.id) && !failed.has(layer.id)) {
            pending.add(layer.id);
            void audio
              .play()
              .catch(() => {
                failed.add(layer.id);
                store.setStatus(
                  '音频预览不可用，请检查素材格式或重新点击播放',
                  true,
                );
              })
              .finally(() => pending.delete(layer.id));
          }
        } else audio.pause();
      }
      for (const [id, audio] of elements.current)
        if (!live.has(id)) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
          elements.current.delete(id);
          const old = sources.get(id);
          if (old?.url.startsWith('blob:')) URL.revokeObjectURL(old.url);
          sources.delete(id);
        }
    };
    const unsubscribe = store.subscribe(update);
    update();
    const activeElements = elements.current;
    return () => {
      disposed = true;
      unsubscribe();
      for (const source of sources.values())
        if (source.url.startsWith('blob:')) URL.revokeObjectURL(source.url);
      sources.clear();
      for (const audio of activeElements.values()) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      activeElements.clear();
    };
  }, [store]);
  return null;
}
