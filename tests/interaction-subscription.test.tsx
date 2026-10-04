// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { useInteractionCancel } from '../src/ui/workspace/interaction';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('取消监听器只注册一次，重渲染使用最新回调，卸载后不再响应', () => {
  const add = vi.spyOn(window, 'addEventListener'),
    remove = vi.spyOn(window, 'removeEventListener');
  const old = vi.fn(),
    latest = vi.fn();
  function Subject({ cancel }: { cancel: () => void }) {
    useInteractionCancel(cancel);
    return null;
  }
  const { rerender, unmount } = render(<Subject cancel={old} />);
  const count = () =>
    add.mock.calls.filter(
      ([name]) => name === 'motion:cancel' || name === 'blur',
    ).length;
  expect(count()).toBe(2);
  for (let i = 0; i < 30; i++) rerender(<Subject cancel={latest} />);
  expect(count()).toBe(2);
  fireEvent(window, new Event('motion:cancel'));
  expect(latest).toHaveBeenCalledTimes(1);
  expect(old).not.toHaveBeenCalled();
  unmount();
  fireEvent.blur(window);
  expect(latest).toHaveBeenCalledTimes(1);
  expect(
    remove.mock.calls.filter(
      ([name]) => name === 'motion:cancel' || name === 'blur',
    ),
  ).toHaveLength(2);
});
