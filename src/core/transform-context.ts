import type { Vec2 } from './core-types';
import type { Matrix2D } from './matrix2d';
import type { RenderLayer, RenderSnapshot } from './renderer-core';

export const transformOrientations = [
  'global',
  'local',
  'parent',
  'view',
] as const;
export type TransformOrientation = (typeof transformOrientations)[number];
export const transformPivotModes = [
  'anchor',
  'object-center',
  'bounds-center',
  'selection-center',
  'individual-origins',
  'custom',
] as const;
export type TransformPivotMode = (typeof transformPivotModes)[number];
export interface Vec3 extends Vec2 {
  readonly z: number;
}
export interface TransformInteractionSettings {
  readonly orientation: TransformOrientation;
  readonly pivotMode: TransformPivotMode;
  readonly customPivot?: Vec2 | Vec3;
}
export const defaultTransformSettings: TransformInteractionSettings =
  Object.freeze({ orientation: 'local', pivotMode: 'anchor' });
export interface TransformBasis {
  readonly x: Vec2;
  readonly y: Vec2;
  readonly matrix: Matrix2D;
  readonly axes3D?: { readonly x: Vec3; readonly y: Vec3; readonly z: Vec3 };
}
export interface TransformContext {
  readonly snapshot: RenderSnapshot;
  readonly selectedLayerIds: readonly string[];
  readonly settings: TransformInteractionSettings;
  readonly basis: TransformBasis;
  readonly pivot: Vec2;
  readonly pivots: ReadonlyMap<string, Vec2>;
  readonly initialTransforms: ReadonlyMap<string, RenderLayer>;
}
