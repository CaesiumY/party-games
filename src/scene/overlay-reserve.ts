import type { Rect } from "../layout/camera-fit";

export interface OverlayReserve {
  reserveTop: number;
  avoid: Rect[];
}

/** 판 영역 맨 위에서 이만큼(px) 안에서 시작하는 겹친 표시는 '위쪽 표시 자리'로 친다. */
const TOP_BAND = 24;

/**
 * 판 영역 위에 겹친 것들(남은 굴림 표시, 지금 차례 표시, 세로 배치의 버튼)의 자리를 카메라 맞춤 입력으로 바꾼다.
 * 맨 위에 붙은 것은 판을 그 아래로 내려 피하고, 나머지는 컵·정렬 줄이 겹치지 않게 피한다.
 * 사각형은 판 영역 왼쪽 위 기준 px.
 */
export function overlayReserve(overlays: readonly Rect[]): OverlayReserve {
  let reserveTop = 0;
  const avoid: Rect[] = [];
  for (const rect of overlays) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) continue;
    if (rect.top <= TOP_BAND) reserveTop = Math.max(reserveTop, rect.bottom);
    else avoid.push(rect);
  }
  return { reserveTop, avoid };
}
