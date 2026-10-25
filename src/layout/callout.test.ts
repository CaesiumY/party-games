import { describe, expect, it } from "vitest";
import { BOARD, boardCorners, holdRowCorners, lineupCorners } from "./board";
import { calloutAnchor } from "./callout";
import { fitCamera, projectPoints } from "./camera-fit";
import type { DieSlot } from "./columns";
import { bubbleBox, layoutHoldBubbles } from "./hold-bubbles";

/** 확인 크기 네 곳의 판 영역과 겹친 표시 자리(#16 디자인 뒤 실측, src/layout/hold-bubbles.test.ts 와 같은 값). */
const BOARDS = [
  {
    name: "375×667 세로",
    width: 343.1,
    height: 284.6,
    reserveTop: 36.8,
    avoid: [{ left: 8, top: 238.6, right: 212.2, bottom: 274.6 }],
  },
  {
    name: "667×375 가로",
    width: 311.1,
    height: 317.1,
    reserveTop: 32.8,
    avoid: [{ left: 106.2, top: 285.1, right: 204.9, bottom: 311.1 }],
  },
  {
    name: "1024×768 가로",
    width: 622.9,
    height: 703.9,
    reserveTop: 40,
    avoid: [{ left: 262.1, top: 671.9, right: 360.8, bottom: 697.9 }],
  },
  {
    name: "1280×720 가로",
    width: 786.7,
    height: 658.8,
    reserveTop: 38.5,
    avoid: [{ left: 344, top: 626.8, right: 442.7, bottom: 652.8 }],
  },
];

const bounds = (points: { x: number; y: number }[]) => ({
  left: Math.min(...points.map((p) => p.x)),
  right: Math.max(...points.map((p) => p.x)),
  top: Math.min(...points.map((p) => p.y)),
  bottom: Math.max(...points.map((p) => p.y)),
});

describe("성립 알림이 쓸 수 있는 높이", () => {
  for (const board of BOARDS) {
    it(`${board.name}: 알림 상자(자리 + 최대 높이)는 정렬 줄 주사위 윗면과 그 위에 뜬 「킵」 말풍선보다 위에서 끝난다`, () => {
      const fit = fitCamera(board);

      const { y, maxHeight } = calloutAnchor(fit, board.reserveTop);

      const lineup = bounds(projectPoints(fit, lineupCorners()));
      expect(y + maxHeight).toBeLessThanOrEqual(lineup.top);
      const lineupSlots = [0, 1, 2, 3, 4].map((i) => ({
        id: i as DieSlot["id"],
        column: i,
        row: "lineup" as const,
      }));
      for (const bubble of layoutHoldBubbles(fit, lineupSlots, board.reserveTop)) {
        if (bubble.side === "above") {
          expect(y + maxHeight).toBeLessThanOrEqual(bubbleBox(bubble).top);
        }
      }
      // 글자가 들어갈 만큼은 남는다(영문 한 줄 + 이름표).
      expect(maxHeight).toBeGreaterThanOrEqual(30);
    });
  }
});

describe("성립 알림 자리", () => {
  for (const board of BOARDS) {
    it(`${board.name}: 홀드 자리 주사위 바로 아래, 정렬 줄 주사위보다 위의 판(펠트) 위에 있다`, () => {
      const fit = fitCamera(board);

      const anchor = calloutAnchor(fit, board.reserveTop);

      const held = bounds(projectPoints(fit, holdRowCorners()));
      const lineup = bounds(projectPoints(fit, lineupCorners()));
      // 홀드한 주사위를 가리지 않는다: 글자 윗변이 홀드 자리 주사위의 아래 끝보다 아래다.
      expect(anchor.y).toBeGreaterThan(held.bottom);
      // 바로 아래: 홀드 자리 주사위와 정렬 줄 주사위 사이의 위쪽 절반 안에 있다.
      expect(anchor.y).toBeLessThan((held.bottom + lineup.top) / 2);
      // 가로로는 판 가운데(펠트 위)다.
      const felt = bounds(
        projectPoints(fit, [
          [-BOARD.width / 2, 0, BOARD.holdRowZ],
          [BOARD.width / 2, 0, BOARD.holdRowZ],
        ]),
      );
      expect(anchor.x).toBeCloseTo((felt.left + felt.right) / 2, 0);
      // 판 영역 안이다.
      const whole = bounds(projectPoints(fit, boardCorners()));
      expect(anchor.y).toBeGreaterThan(whole.top);
      expect(anchor.y).toBeLessThan(board.height);
    });
  }
});
