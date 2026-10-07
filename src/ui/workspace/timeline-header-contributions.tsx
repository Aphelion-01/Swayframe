import type { ComponentType } from 'react';
import type { EditorStore, EditorView } from '../editor-store';
import type { Composition } from '../../core/project-model';
import { formatTimecode, snapToFrame } from '../../core/timeline-time';
import { features } from '../../shared/feature-catalog';
import { Icon } from './icons';
import { IconButton } from './primitives';
interface TransportContext {
  store: EditorStore;
  view: Pick<EditorView, 'playing' | 'time'>;
  c: Composition;
  loop: boolean;
  setLoop: (value: boolean) => void;
  snapping: boolean;
  setSnapping: (value: boolean) => void;
  timecode: boolean;
  setTimecode: (value: boolean) => void;
}
const widgets = new Map<string, ComponentType<TransportContext>>();
export function registerTimelineHeader(
  id: string,
  component: ComponentType<TransportContext>,
) {
  if (widgets.has(id)) throw Error('时间轴工具重复注册');
  widgets.set(id, component);
}
function Playback({
  store,
  view,
  c,
  loop,
  setLoop,
  snapping,
  setSnapping,
  timecode,
  setTimecode,
}: TransportContext) {
  return (
    <div className="playback-controls">
      <button
        aria-label="回到起点"
        onClick={() => {
          store.setPlaying(false);
          store.setTime(0);
        }}
      >
        <Icon name="start" />
      </button>
      <IconButton
        label="回到终点"
        onClick={() => {
          store.setPlaying(false);
          store.setTime(c.duration);
        }}
      >
        <Icon name="start" style={{ transform: 'rotate(180deg)' }} />
      </IconButton>
      <button
        aria-label={view.playing ? '暂停' : '播放'}
        className="play-button"
        onClick={() => store.setPlaying(!view.playing)}
      >
        <Icon name={view.playing ? 'pause' : 'play'} />
      </button>
      <label className="time-field">
        <input
          aria-label="当前时间（秒）"
          type="number"
          min={0}
          max={c.duration}
          step={1 / c.fps}
          value={Number(view.time.toFixed(3))}
          onChange={(event) => {
            store.setPlaying(false);
            store.setTime(snapToFrame(Number(event.target.value), c.fps));
          }}
        />
        <span>秒</span>
      </label>
      <IconButton
        label="停止"
        onClick={() => {
          store.setPlaying(false);
          store.setTime(0);
        }}
      >
        <Icon name="stop" />
      </IconButton>
      <IconButton
        label="循环播放"
        aria-pressed={loop}
        onClick={() => setLoop(!loop)}
      >
        <Icon name="loop" />
      </IconButton>
      <IconButton
        label="时间轴吸附"
        aria-pressed={snapping}
        title="关键帧吸附到播放头、其他关键帧和边界 · Cmd/Ctrl 临时关闭"
        onClick={() => setSnapping(!snapping)}
      >
        <Icon name="snap" />
      </IconButton>
      <button
        className="timecode"
        title="切换秒 / 时间码"
        onClick={() => setTimecode(!timecode)}
      >
        {timecode
          ? formatTimecode(view.time, c.fps)
          : `${view.time.toFixed(3)} s`}
      </button>
    </div>
  );
}
registerTimelineHeader('timeline', Playback);
export function TimelineHeaderContributions(props: TransportContext) {
  return (
    <>
      {features.contributions('timeline.header').map((f) => {
        const Component = widgets.get(f.id);
        return Component ? <Component key={f.id} {...props} /> : null;
      })}
    </>
  );
}
