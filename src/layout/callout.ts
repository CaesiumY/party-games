import { BOARD, holdRowCorners, lineupCorners } from "./board";
import { type CameraFit, projectPoints } from "./camera-fit";
import { COLUMNS, type DieSlot } from "./columns";
import { bubbleBox, layoutHoldBubbles } from "./hold-bubbles";

/** 홀드 자리 주사위의 아래 끝과 알림 윗변 사이, 알림 아랫변과 정렬 줄(또는 그 위 「킵」 말풍선) 사이(px). */
const GAP = 4;

/** 정렬 줄 다섯 칸 모두에 주사위가 있을 때. 「킵」 말풍선이 주사위 위에 뜨는지 보려고 쓴다. */
const ALL_LINEUP: DieSlot[] = COLUMNS.map((i) => ({
  id: i as DieSlot["id"],
  column: i,
  row: "lineup",
}));

export interface CalloutAnchor {
  /** 알림의 가로 가운데(px, 판 영역 왼쪽 위 기준). */
  x: number;
  /** 알림 상자의 윗변(px). */
  y: number;
  /** 알림 상자가 쓸 수 있는 높이(px). 이 높이 안에서 끝나면 정렬 줄 주사위와 그 위 말풍선을 가리지 않는다. */
  maxHeight: number;
}

/**
 * 성립 알림의 자리와 크기(스펙 「굴림 연출」 성립 알림, DESIGN.md 결정 기록). 3D 를 그리지 않는 계산이다.
 * 원작처럼 판 위쪽 가운데, 홀드 자리 줄 바로 아래의 펠트 위에 띄운다. 홀드한 주사위를 가리지 않도록
 * 홀드 자리 주사위가 화면에 그려지는 아래 끝보다 조금 아래에 윗변을 두고, 정렬 줄 주사위의 윗면(그 위에
 * 「킵」 말풍선이 뜨는 화면이면 말풍선 윗변)보다 조금 위에서 끝나도록 쓸 수 있는 높이를 정한다.
 * 화면은 이 높이에 맞춰 글자·그림 크기를 줄인다(그래서 휴대폰 세로처럼 틈이 좁은 화면에서 작아진다).
 * `topLimit` 은 위쪽 표시 자리의 아래 끝(px)으로, 홀드 말풍선 자리를 정할 때와 같은 값이다.
 */
export function calloutAnchor(fit: CameraFit, topLimit: number): CalloutAnchor {
  const held = projectPoints(fit, holdRowCorners());
  const top = Math.max(...held.map((p) => p.y)) + GAP;
  const lineupTop = Math.min(...projectPoints(fit, lineupCorners()).map((p) => p.y));
  const bubbleTops = layoutHoldBubbles(fit, ALL_LINEUP, topLimit)
    .filter((b) => b.side === "above")
    .map((b) => bubbleBox(b).top);
  const bottom = Math.min(lineupTop, ...bubbleTops) - GAP;
  const [center] = projectPoints(fit, [[0, 0, BOARD.holdRowZ]]);
  return { x: center?.x ?? fit.view.fullWidth / 2, y: top, maxHeight: Math.max(0, bottom - top) };
}
