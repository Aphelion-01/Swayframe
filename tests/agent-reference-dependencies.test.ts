import { expect, it } from 'vitest';
import { referenceAnalysisSchema } from '../src/agent/reference-analysis';
const element = (id: string, dependencies: string[]) => ({
  id,
  dependencies,
  type: 'geometry',
  bounds: { x: 0, y: 0, width: 20, height: 20 },
  position: '中心',
  layering: 1,
  geometry: '四边形',
  colors: [],
  gradients: [],
  effects: [],
  typography: '',
  confidence: 0.8,
  mapping: 'createPath',
});
const analysis = (elements: ReturnType<typeof element>[]) => ({
  canvas: { width: 100, height: 100, background: '灰' },
  visualElements: elements,
  spatialRelationships: [],
  limitations: [],
  confidence: 0.8,
});
it('accepts a dependency chain and rejects cycles before reconstruction', () => {
  expect(
    referenceAnalysisSchema.safeParse(
      analysis([element('a', []), element('b', ['a']), element('c', ['b'])]),
    ).success,
  ).toBe(true);
  expect(() =>
    referenceAnalysisSchema.parse(
      analysis([element('a', ['b']), element('b', ['a'])]),
    ),
  ).toThrow('循环');
});
