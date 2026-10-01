import type { EditorElement, PageSize } from "./document";

export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const MIN_WIDTH = 20;
const MIN_HEIGHT = 20;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
}

// 드래그한 방향의 변만 움직이고 반대편 변은 고정한다. 페이지 밖이나 최소 크기 아래로는 줄이지 않는다.
export function resizeElement<T extends EditorElement>(
  element: T,
  page: PageSize,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
): T {
  let left = element.x;
  let top = element.y;
  let right = element.x + element.width;
  let bottom = element.y + element.height;
  const minWidth = Math.min(MIN_WIDTH, page.width);
  const minHeight = Math.min(MIN_HEIGHT, page.height);

  if (handle.includes("w")) left = clamp(left + deltaX, 0, right - minWidth);
  if (handle.includes("e"))
    right = clamp(right + deltaX, left + minWidth, page.width);
  if (handle.includes("n")) top = clamp(top + deltaY, 0, bottom - minHeight);
  if (handle.includes("s"))
    bottom = clamp(bottom + deltaY, top + minHeight, page.height);

  return {
    ...element,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
