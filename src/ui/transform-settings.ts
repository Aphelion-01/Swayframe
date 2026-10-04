import {
  defaultTransformSettings,
  transformOrientations,
  transformPivotModes,
} from '../core/transform-context';
import type { TransformInteractionSettings } from '../core/transform-context';
import { isVec2 } from '../core/core-types';
const key = 'swayframe.transform-settings.v1';
export function readTransformSettings(): TransformInteractionSettings {
  if (typeof window === 'undefined') return defaultTransformSettings;
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    return {
      orientation: transformOrientations.includes(raw?.orientation)
        ? raw.orientation
        : defaultTransformSettings.orientation,
      pivotMode: transformPivotModes.includes(raw?.pivotMode)
        ? raw.pivotMode
        : defaultTransformSettings.pivotMode,
      ...(isVec2(raw?.customPivot)
        ? { customPivot: { x: raw.customPivot.x, y: raw.customPivot.y } }
        : {}),
    };
  } catch {
    return defaultTransformSettings;
  }
}
export function writeTransformSettings(
  settings: TransformInteractionSettings,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    /* Preferences are optional. */
  }
}
