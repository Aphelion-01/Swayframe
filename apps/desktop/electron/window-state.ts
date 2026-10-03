export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface WindowState extends Bounds {
  maximized: boolean;
}
export function visibleWindow(
  saved: Partial<WindowState> | null,
  screens: readonly Bounds[],
): WindowState {
  const primary = screens[0] ?? { x: 0, y: 0, width: 1440, height: 940 };
  let width = Math.max(
    900,
    Math.min(
      typeof saved?.width === 'number' && Number.isFinite(saved.width)
        ? saved.width
        : 1440,
      Math.max(900, primary.width),
    ),
  );
  let height = Math.max(
    600,
    Math.min(
      typeof saved?.height === 'number' && Number.isFinite(saved.height)
        ? saved.height
        : 940,
      Math.max(600, primary.height),
    ),
  );
  let x =
    typeof saved?.x === 'number' && Number.isFinite(saved.x)
      ? saved.x
      : primary.x + Math.max(0, (primary.width - width) / 2);
  let y =
    typeof saved?.y === 'number' && Number.isFinite(saved.y)
      ? saved.y
      : primary.y + Math.max(0, (primary.height - height) / 2);
  const screen =
    screens.find(
      (s) =>
        x + 100 > s.x &&
        x < s.x + s.width - 100 &&
        y + 80 > s.y &&
        y < s.y + s.height - 80,
    ) ?? primary;
  width = Math.min(width, screen.width);
  height = Math.min(height, screen.height);
  x = Math.max(screen.x, Math.min(x, screen.x + screen.width - width));
  y = Math.max(screen.y, Math.min(y, screen.y + screen.height - height));
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    maximized: saved?.maximized === true,
  };
}
