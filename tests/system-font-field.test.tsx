// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue(['Arial', '苹方', 'Custom Practice Font']),
}));
vi.mock('../src/desktop/service', () => ({
  desktopService: { api: { fonts: native } },
}));
import { SystemFontField } from '../src/ui/SystemFontField';
afterEach(cleanup);
it('系统字体成为可筛选选项，实时预览、提交和取消保持原参数入口', async () => {
  const preview = vi.fn(),
    commit = vi.fn(),
    cancel = vi.fn();
  render(
    <SystemFontField
      value="Arial"
      onPreview={preview}
      onCommit={commit}
      onCancel={cancel}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('3 个系统字体'),
  );
  expect(
    document.querySelector('option[value="Custom Practice Font"]'),
  ).not.toBeNull();
  const input = screen.getByLabelText('字体');
  fireEvent.change(input, { target: { value: '苹方' } });
  expect(preview).toHaveBeenLastCalledWith('苹方');
  fireEvent.blur(input);
  expect(commit).toHaveBeenLastCalledWith('苹方');
  fireEvent.change(input, { target: { value: 'Arial' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(cancel).toHaveBeenCalled();
});
