import { useEditorSlice } from './use-editor-slice';
import { guidanceFor } from './transform-guidance-controller';
import { pivotLabels, TransformControls } from './TransformControls';
import type { EditorStore } from './editor-store';
import type { TransformPivotMode } from '../core/transform-context';
const grid: readonly TransformPivotMode[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'object-center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];
const origins: readonly TransformPivotMode[] = [
  'anchor',
  'bounds-center',
  'selection-center',
  'individual-origins',
  'custom',
  'world-origin',
];
export function PivotSelector({
  store,
  disabled = false,
}: {
  store: EditorStore;
  disabled?: boolean;
}) {
  const view = useEditorSlice(store, ['transformSettings']);
  const controller = guidanceFor(store);
  const button = (mode: TransformPivotMode, point = false) => (
    <button
      key={mode}
      disabled={disabled}
      type="button"
      aria-label={`支点：${pivotLabels[mode]}`}
      title={pivotLabels[mode]}
      aria-pressed={view.transformSettings.pivotMode === mode}
      onMouseEnter={() => controller.preview({ pivotMode: mode })}
      onMouseLeave={() => controller.preview()}
      onFocus={() => controller.preview({ pivotMode: mode })}
      onBlur={() => controller.preview()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          controller.preview();
          event.currentTarget.blur();
        }
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (point) {
            const buttons = Array.from(
              event.currentTarget.parentElement!.querySelectorAll('button'),
            );
            const delta =
              event.key === 'ArrowLeft'
                ? -1
                : event.key === 'ArrowRight'
                  ? 1
                  : event.key === 'ArrowUp'
                    ? -3
                    : 3;
            buttons[
              (buttons.indexOf(event.currentTarget) + delta + 9) % 9
            ]?.focus();
          }
        }
      }}
      onClick={() => {
        store.commitTransformReference({ pivotMode: mode });
        controller.committed();
      }}
    >
      {point ? (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
        </svg>
      ) : (
        pivotLabels[mode]
      )}
    </button>
  );
  return (
    <div className="pivot-selector" aria-label="变换参考选择器">
      <TransformControls store={store} disabled={disabled} labelPrefix="属性" />
      <div className="pivot-selector-body">
        <div className="pivot-grid" role="group" aria-label="九宫格变换支点">
          {grid.map((mode) => button(mode, true))}
        </div>
        <div className="pivot-origins" role="group" aria-label="支点来源">
          {origins.map((mode) => button(mode))}
        </div>
      </div>
    </div>
  );
}
