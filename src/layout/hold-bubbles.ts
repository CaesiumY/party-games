import { BOARD, columnX, type Vec3 } from "./board";
import { type CameraFit, projectPoints } from "./camera-fit";
import type { DieSlot, Row } from "./columns";

/**
 * 홀드 말풍선의 화면 자리(스펙 「3D 장면」 홀드 말풍선). 3D 를 그리지 않는 계산이다.
 * 말풍선은 주사위 윗면 뒤쪽 모서리 위에 뜬다. 이웃 말풍선과 겹칠 만큼 열 간격이 좁으면
 * 홀수 열의 말풍선을 주사위 앞쪽 아래로 엇갈려 두고, 그래도 모자라면 글자를 줄인다(시안 v6).
 * 가장 작은 글자로도 같은 단의 이웃과 닿으면 상자 여백을 줄인다.
 * 위쪽 표시 자리(남은 굴림·지금 차례)에 닿거나 먼저 놓은 홀드 자리의 말풍선과 겹치면
 * 그 줄의 말풍선은 모두 주사위 앞쪽 아래로 둔다.
 * 어느 쪽이든 윗면(눈)은 가리지 않는다.
 */

/** 홀드 자리의 주사위는 "되돌리기", 정렬 줄의 주사위는 "킵"(원작 한국어판 문구). */
export const BUBBLE_LABEL: Record<Row, string> = { hold: "되돌리기", lineup: "킵" };

/** 말풍선 상자 치수(px). 누르는 영역은 가로·세로 24px 이상이다. */
export const BUBBLE = {
  height: 24,
  minWidth: 28,
  paddingX: 5,
  /** 엇갈려도 한 줄 건너 이웃과 겹칠 만큼 좁을 때의 여백. 화면 CSS 의 실제 여백과 같다. */
  tightPaddingX: 3,
  border: 2,
  /** 기준점과 상자 사이(꼬리 자리). */
  gap: 6,
  fontSize: 11,
  minFontSize: 9,
} as const;

/**
 * 말풍선이 주사위의 어느 쪽에 붙는지. above = 윗면 뒤쪽 모서리 위, below = 주사위 앞쪽 아래,
 * below2 = below 보다 한 칸 더 아래(위쪽에 자리가 없어 엇갈림을 아래에서 할 때).
 */
export type BubbleSide = "above" | "below" | "below2";

export interface HoldBubble {
  id: DieSlot["id"];
  label: string;
  /** 기준점(px, 판 영역 왼쪽 위 기준). 상자는 이 점의 가로 가운데에 놓인다. */
  x: number;
  y: number;
  side: BubbleSide;
  fontSize: number;
  /** 상자 폭(px). 화면도 이 폭 그대로 그린다. */
  width: number;
}

export interface BubbleBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 글자 폭은 한글 한 자 = 글자 크기로 어림한다. 화면은 이 폭을 그대로 쓴다. */
function bubbleWidth(label: string, fontSize: number, paddingX: number = BUBBLE.paddingX): number {
  return Math.max(
    BUBBLE.minWidth,
    Math.ceil(label.length * fontSize + 2 * (paddingX + BUBBLE.border)),
  );
}

/** 말풍선 상자가 차지하는 화면 사각형(px). */
export function bubbleBox(b: HoldBubble): BubbleBox {
  const left = b.x - b.width / 2;
  const right = b.x + b.width / 2;
  if (b.side === "above") {
    const bottom = b.y - BUBBLE.gap;
    return { left, right, top: bottom - BUBBLE.height, bottom };
  }
  const top = b.y + BUBBLE.gap + (b.side === "below2" ? BUBBLE.height + 2 : 0);
  return { left, right, top, bottom: top + BUBBLE.height };
}

function overlaps(a: BubbleBox, b: BubbleBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

const rowZ = (row: Row) => (row === "hold" ? BOARD.holdRowZ : BOARD.lineupZ);

/** 윗면 높이에서 주사위 뒤쪽(above) 또는 앞쪽(below) 바로 바깥의 점. */
function anchor(column: number, row: Row, side: "above" | "below"): Vec3 {
  const dz = side === "above" ? -BOARD.die * 0.6 : BOARD.die * 0.7;
  return [columnX(column), BOARD.die, rowZ(row) + dz];
}

/** 그 줄에서 이웃한 열 사이의 가장 좁은 화면 거리(px). */
function columnSpacing(fit: CameraFit, row: Row): number {
  const points = projectPoints(
    fit,
    [0, 1, 2, 3, 4].map((c): Vec3 => [columnX(c), BOARD.die, rowZ(row)]),
  );
  let gap = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [points[i - 1], points[i]];
    if (a && b) gap = Math.min(gap, Math.abs(b.x - a.x));
  }
  return gap;
}

/**
 * 보이는 주사위마다의 말풍선 자리. `slots` 는 홀드할 수 있는 주사위만 넘긴다.
 * `topLimit` 은 위쪽 표시 자리의 아래 끝(px). 말풍선은 그 아래에만 놓는다.
 */
export function layoutHoldBubbles(
  fit: CameraFit,
  slots: readonly DieSlot[],
  topLimit: number,
): HoldBubble[] {
  const plan = planRows(fit, topLimit);
  return slots.flatMap((s) => {
    const b = plan[s.row][s.column];
    return b ? [{ ...b, id: s.id }] : [];
  });
}

/**
 * 두 줄의 다섯 열 모두에 말풍선이 있다고 치고 자리를 정한다. 그래서 한 말풍선의 자리는
 * 카메라 맞춤과 그 주사위의 열·줄로만 정해지고, 다른 주사위를 홀드해도 움직이지 않는다
 * (연달아 탭할 때 누르려던 말풍선이 옮겨 가지 않게).
 */
function planRows(fit: CameraFit, topLimit: number): Record<Row, HoldBubble[]> {
  const plan: Record<Row, HoldBubble[]> = { hold: [], lineup: [] };
  const placedBoxes: BubbleBox[] = [];
  for (const row of ["hold", "lineup"] as const) {
    const label = BUBBLE_LABEL[row];
    const gap = columnSpacing(fit, row);
    const widest = bubbleWidth(label, BUBBLE.fontSize);
    const stagger = gap < widest + 4;
    const fontSize = stagger
      ? Math.max(
          BUBBLE.minFontSize,
          Math.min(BUBBLE.fontSize, Math.floor((BUBBLE.fontSize * (2 * gap - 6)) / widest)),
        )
      : BUBBLE.fontSize;
    // 엇갈린 같은 단의 말풍선은 두 열 건너 이웃이다. 가장 작은 글자로도 그 간격에 닿으면 여백을 줄인다
    // (375×667 에서 「0점으로 기록」 버튼 때문에 판이 작아질 때, #44).
    const roomy = bubbleWidth(label, fontSize);
    const width =
      stagger && roomy >= 2 * gap ? bubbleWidth(label, fontSize, BUBBLE.tightPaddingX) : roomy;
    // id 는 자리를 정한 뒤 layoutHoldBubbles 가 그 열의 주사위로 채운다.
    const place = (column: number, side: BubbleSide): HoldBubble => {
      const [p] = projectPoints(fit, [anchor(column, row, side === "above" ? "above" : "below")]);
      return { id: 0, label, x: p?.x ?? 0, y: p?.y ?? 0, side, fontSize, width };
    };
    const odd = (column: number) => stagger && column % 2 === 1;
    const columns = [0, 1, 2, 3, 4];
    const above = columns.map((c) => place(c, odd(c) ? "below" : "above"));
    const below = columns.map((c) => place(c, odd(c) ? "below2" : "below"));
    const fits = (candidate: HoldBubble[]) =>
      candidate.every((b) => {
        const box = bubbleBox(b);
        return box.top >= topLimit && placedBoxes.every((o) => !overlaps(o, box));
      });
    plan[row] = fits(above) ? above : below;
    placedBoxes.push(...plan[row].map(bubbleBox));
  }
  return plan;
}
