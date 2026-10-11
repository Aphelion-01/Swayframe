import { newId } from './core-types';
import type { AnimValue } from './core-types';
import {
  sealEffect,
  validateEffect,
  compileEffect,
} from './programmable-effect';
import type { EffectPackage, EffectPackageSource } from './programmable-effect';
export type DraftState =
  | 'draft'
  | 'validated'
  | 'compiled'
  | 'previewed'
  | 'evaluated'
  | 'accepted'
  | 'discarded';
export interface EffectDraft {
  readonly id: string;
  readonly package: EffectPackage;
  readonly state: DraftState;
  readonly diagnostics: readonly string[];
  readonly preview?: {
    readonly width: number;
    readonly height: number;
    readonly time: number;
    readonly pixels: Uint8ClampedArray;
    readonly hash: string;
  };
  readonly evaluation?: string;
}
export class EffectForgeWorkspace {
  private drafts = new Map<string, EffectDraft>();
  all() {
    return [...this.drafts.values()].filter((d) => d.state !== 'discarded');
  }
  get(id: string) {
    const draft = this.drafts.get(id);
    if (!draft || draft.state === 'discarded') throw Error('效果草稿不存在');
    return draft;
  }
  private set(d: EffectDraft) {
    this.drafts.set(d.id, d);
    return d;
  }
  create(source: EffectPackageSource | EffectPackage) {
    if (this.all().length >= 20) throw Error('草稿最多20项');
    const p =
      'contentHash' in source ? validateEffect(source) : sealEffect(source);
    return this.set({
      id: newId(),
      package: p,
      state: 'draft',
      diagnostics: [],
    });
  }
  update(id: string, source: EffectPackageSource | EffectPackage) {
    const d = this.get(id),
      p = 'contentHash' in source ? validateEffect(source) : sealEffect(source);
    return this.set({
      ...d,
      package: p,
      state: 'draft',
      diagnostics: [],
      preview: undefined,
      evaluation: undefined,
    });
  }
  validate(id: string) {
    const d = this.get(id);
    try {
      validateEffect(d.package);
      return this.set({ ...d, state: 'validated', diagnostics: [] });
    } catch (e) {
      this.set({
        ...d,
        diagnostics: [e instanceof Error ? e.message : '验证失败'],
      });
      throw e;
    }
  }
  compile(id: string) {
    const d = this.get(id);
    if (d.state !== 'validated') throw Error('请先验证草稿');
    compileEffect(d.package);
    return this.set({ ...d, state: 'compiled' });
  }
  preview(
    id: string,
    params: Readonly<Record<string, AnimValue>> = {},
    time = 0,
    input?: Uint8ClampedArray,
  ) {
    const d = this.get(id);
    if (!['compiled', 'previewed', 'evaluated'].includes(d.state))
      throw Error('请先编译草稿');
    const width = 192,
      height = 108;
    if (d.package.category === 'filter' && !input) {
      input = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4,
            v = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 ? 210 : 70;
          input[i] = v;
          input[i + 1] = 120;
          input[i + 2] = 255 - v;
          input[i + 3] = 255;
        }
    }
    const pixels = compileEffect(d.package).render(
      params,
      { time, frame: Math.round(time * 30), width, height },
      input,
    );
    return this.set({
      ...d,
      state: 'previewed',
      evaluation: undefined,
      preview: { width, height, time, pixels, hash: d.package.contentHash },
    });
  }
  evaluate(id: string, note: string) {
    const d = this.get(id);
    if (d.state !== 'previewed' || !d.preview || !note.trim())
      throw Error('请先预览并填写检查结论');
    return this.set({
      ...d,
      state: 'evaluated',
      evaluation: note.trim().slice(0, 1000),
    });
  }
  ready(id: string) {
    const d = this.get(id);
    if (d.state !== 'evaluated' || d.preview?.hash !== d.package.contentHash)
      throw Error('草稿必须完成当前版本的预览与检查');
    return d;
  }
  accept(id: string) {
    const d = this.ready(id);
    return this.set({ ...d, state: 'accepted' });
  }
  discard(id: string) {
    return this.set({
      ...this.get(id),
      state: 'discarded',
      preview: undefined,
    });
  }
}
export const effectForge = new EffectForgeWorkspace();
