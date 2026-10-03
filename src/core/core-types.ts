export type ID = string;
export type Seconds = number;
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}
export interface Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}
export type AnimValue = number | Vec2 | readonly number[];
export const newId = (): ID => crypto.randomUUID();
export const isVec2 = (value: unknown): value is Vec2 =>
  typeof value === 'object' &&
  value !== null &&
  'x' in value &&
  'y' in value &&
  typeof value.x === 'number' &&
  Number.isFinite(value.x) &&
  typeof value.y === 'number' &&
  Number.isFinite(value.y);
export const isAnimValue = (value: unknown): value is AnimValue =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  isVec2(value) ||
  (Array.isArray(value) &&
    value.length <= 12000 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v)));
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
