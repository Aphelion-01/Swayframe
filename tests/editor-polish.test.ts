import { expect, it } from 'vitest';
import {
  resolutionPresets,
  frameRates,
  defaultOutputSettings,
  outputRect,
  validateOutputSettings,
} from '../src/core/output-settings';
import {
  createDefaultProject,
  activeComposition,
  createLayer,
} from '../src/core/project-model';
import { layoutText } from '../src/core/text-geometry';
import { loadProject, saveProject } from '../src/core/project-io';
import { visibleProperties } from '../src/ui/property-labels';
it('common composition presets and independent export sizing preserve aspect ratio', () => {
  const settings = defaultOutputSettings(
    activeComposition(createDefaultProject()),
  );
  for (const p of resolutionPresets)
    expect(() => validateOutputSettings({ ...settings, ...p })).not.toThrow();
  expect(frameRates).toEqual(
    expect.arrayContaining([23.976, 29.97, 59.94, 120]),
  );
  const vertical = { ...settings, width: 1080, height: 1920 };
  expect(outputRect(1920, 1080, vertical)).toEqual({
    x: 0,
    y: 656.25,
    width: 1080,
    height: 607.5,
  });
  expect(
    outputRect(1920, 1080, { ...vertical, fit: 'cover' }).width,
  ).toBeGreaterThan(1080);
  expect(outputRect(1920, 1080, { ...vertical, fit: 'stretch' })).toEqual({
    x: 0,
    y: 0,
    width: 1080,
    height: 1920,
  });
  expect(() => validateOutputSettings({ ...settings, fps: NaN })).toThrow();
  expect(() => validateOutputSettings({ ...settings, width: 9000 })).toThrow();
});
it('text range animation changes glyphs without changing the layer and survives project IO', () => {
  const p = createDefaultProject(),
    text = createLayer('text');
  expect(text.type === 'text' && text.text).toBe('请输入文本');
  const props = text.editor!.properties;
  const configured = {
    ...text,
    text: 'AB',
    editor: {
      ...text.editor!,
      properties: {
        ...props,
        textAnimatorEnabled: { ...props.textAnimatorEnabled!, baseValue: 1 },
        textRangeEnd: { ...props.textRangeEnd!, baseValue: 50 },
      },
    },
  } as typeof text;
  const before = JSON.stringify(configured),
    glyphs = layoutText(configured, 0, () => ({ width: 20 }));
  expect(glyphs[0]).toMatchObject({ opacity: 0, y: 40 });
  expect(glyphs[1]).toMatchObject({ opacity: 1, y: 0 });
  expect(JSON.stringify(configured)).toBe(before);
  const project = {
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers: [configured] })),
  };
  expect(loadProject(saveProject(project))).toEqual(project);
  expect(
    visibleProperties(configured).some((e) => e.key.endsWith('textRangeEnd')),
  ).toBe(true);
  expect(
    visibleProperties(createLayer('rectangle')).some((e) =>
      e.key.includes('textAnimator'),
    ),
  ).toBe(false);
});
