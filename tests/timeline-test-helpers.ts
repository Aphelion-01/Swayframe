import { fireEvent } from '@testing-library/react';
/** Existing workflow tests explicitly disclose the default-collapsed Timeline tree. */
export function openTimelineLayers() {
  document
    .querySelectorAll(
      '.timeline-layer .layer-disclosure[aria-expanded="false"]',
    )
    .forEach((button) => fireEvent.click(button));
}
