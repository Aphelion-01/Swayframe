// @vitest-environment jsdom
import { expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EffectBrowser } from '../src/ui/EffectBrowser';
import { effectForge } from '../src/core/effect-forge';
import { organicTexturePackage } from '../src/core/effect-examples';
afterEach(() => {
  cleanup();
  for (const d of effectForge.all()) effectForge.discard(d.id);
  localStorage.clear();
  vi.restoreAllMocks();
});
it('requires preview and explicit acceptance before saving user package', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
  );
  const onApply = vi.fn(() => true);
  render(
    <EffectBrowser
      onClose={() => {}}
      onSelect={() => {}}
      onPackageSelect={onApply}
    />,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'AI 草稿 / 导入' }));
  fireEvent.click(screen.getByRole('button', { name: '创建流动纹理示例草稿' }));
  expect(screen.queryByRole('button', { name: '确认应用到工程' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '验证' }));
  fireEvent.click(screen.getByRole('button', { name: '编译' }));
  fireEvent.click(screen.getByRole('button', { name: '渲染预览' }));
  expect(screen.getByLabelText('效果真实像素预览')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('效果检查结论'), {
    target: { value: '检查纹理与颜色' },
  });
  fireEvent.click(screen.getByRole('button', { name: '确认已检查预览' }));
  fireEvent.click(screen.getByRole('button', { name: '确认应用到工程' }));
  expect(onApply).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('swayframe.effect-library.v1')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '保存到我的效果库' }));
  expect(
    JSON.parse(localStorage.getItem('swayframe.effect-library.v1')!)[0]
      .contentHash,
  ).toBe(organicTexturePackage().contentHash);
});
