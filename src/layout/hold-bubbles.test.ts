import { describe, expect, it } from "vitest";
import { BOARD, columnX } from "./board";
import { fitCamera, projectPoints } from "./camera-fit";
import type { DieSlot } from "./columns";
import { type BubbleBox, bubbleBox, layoutHoldBubbles } from "./hold-bubbles";

/**
 * 확인 크기 네 곳(4인 대전)의 판 영역 크기, 위쪽 표시 자리, 판 위에 겹친 것(세로 배치는 왼쪽 아래 버튼,
 * 가로 배치는 아래 가운데의 지금 차례 표시)의 자리. 시안 v6 실측값에 가깝게.
 */
const BOARDS = [
  {
    name: "375×667 세로",
    width: 343,
    height: 284,
    reserveTop: 32,
    avoid: [{ left: 10, top: 238, right: 210, bottom: 274 }],
  },
  {
    name: "667×375 가로",
    width: 373,
    height: 311,
    reserveTop: 32,
    avoid: [{ left: 136, top: 275, right: 236, bottom: 303 }],
  },
  {
    name: "1024×768 가로",
    width: 643,
    height: 698,
    reserveTop: 34,
    avoid: [{ left: 271, top: 662, right: 371, bottom: 690 }],
  },
  {
    name: "1280×720 가로",
    width: 812,
    height: 653,
    reserveTop: 34,
    avoid: [{ left: 356, top: 617, right: 456, bottom: 645 }],
  },
  // 아래 넷은 #16 디자인(자체 글꼴, 36px 버튼) 뒤, 다섯 주사위를 모두 홀드하고 0점 카테고리를 골라
  // 기록 버튼이 「0점으로 기록」일 때의 실측값이다(#44). 가로 배치의 버튼은 판 영역 밖이라 빠진다.
  {
    name: "375×667 세로, 「0점으로 기록」(#16 뒤)",
    width: 343.1,
    height: 284.6,
    reserveTop: 36.8,
    avoid: [{ left: 8, top: 238.6, right: 212.2, bottom: 274.6 }],
  },
  {
    name: "667×375 가로, 「0점으로 기록」(#16 뒤)",
    width: 311.1,
    height: 317.1,
    reserveTop: 32.8,
    avoid: [{ left: 106.2, top: 285.1, right: 204.9, bottom: 311.1 }],
  },
  {
    name: "1024×768 가로, 「0점으로 기록」(#16 뒤)",
    width: 622.9,
    height: 703.9,
    reserveTop: 40,
    avoid: [{ left: 262.1, top: 671.9, right: 360.8, bottom: 697.9 }],
  },
  {
    name: "1280×720 가로, 「0점으로 기록」(#16 뒤)",
    width: 786.7,
    height: 658.8,
    reserveTop: 38.5,
    avoid: [{ left: 344, top: 626.8, right: 442.7, bottom: 652.8 }],
  },
  {
    // #16 전(yacht-mvp)에는 「0점으로 기록」 버튼이 더 넓어 판이 작아졌고, 홀드 자리 열 간격이 약 23px 로
    // 좁아져 말풍선끼리 겹쳤다(#44 재현 실측). 지금 디자인에서는 이만큼 좁아지지 않지만, 버튼이나 표시가
    // 다시 넓어질 때를 지키려고 남긴다.
    name: "375×667 세로, 판이 좁아진 「0점으로 기록」(#16 전)",
    width: 343,
    height: 283,
    reserveTop: 38,
    avoid: [{ left: 10, top: 237, right: 232, bottom: 273 }],
    /**
     * 알려진 문제(#44 범위 밖): 홀드 자리 눈 아래(약 66px)부터 정렬 줄 눈 위(약 116px)까지 50px 인데,
     * 엇갈린 두 단은 6 + 24 + 2 + 24 = 56px 가 든다. 그래서 아랫단 말풍선이 옆 열 정렬 줄 주사위의 눈
     * 귀퉁이를 덮는다. 이 크기에서는 말풍선 자리만 바꿔서는 풀 수 없다(카메라 맞춤이 말풍선 자리를 함께
     * 따지거나, 위쪽 표시 사이의 빈 자리를 쓰는 별도 작업). 고쳐지면 `it.fails` 가 실패해 알려 준다.
     */
    knownFaceCover: ["넷은 홀드 자리, 하나는 정렬 줄"],
  },
];

const slot = (id: number, column: number, row: DieSlot["row"]): DieSlot => ({
  id: id as DieSlot["id"],
  column,
  row,
});

const CASES: { name: string; slots: DieSlot[] }[] = [
  { name: "모두 정렬 줄", slots: [0, 1, 2, 3, 4].map((i) => slot(i, i, "lineup")) },
  {
    name: "넷은 홀드 자리, 하나는 정렬 줄",
    slots: [0, 1, 2, 3].map((i) => slot(i, i, "hold")).concat(slot(4, 4, "lineup")),
  },
  {
    name: "홀드 자리와 정렬 줄이 섞임",
    slots: [
      slot(0, 0, "hold"),
      slot(1, 1, "lineup"),
      slot(2, 2, "hold"),
      slot(3, 3, "lineup"),
      slot(4, 4, "hold"),
    ],
  },
  { name: "모두 홀드 자리", slots: [0, 1, 2, 3, 4].map((i) => slot(i, i, "hold")) },
];

const overlaps = (a: BubbleBox, b: BubbleBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** 그 자리에 놓인 주사위 윗면의 화면 사각형. */
function topFace(fit: ReturnType<typeof fitCamera>, s: DieSlot): BubbleBox {
  const z = s.row === "hold" ? BOARD.holdRowZ : BOARD.lineupZ;
  const h = BOARD.die / 2;
  const corners = [-h, h].flatMap((dx) =>
    [-h, h].map((dz) => [columnX(s.column) + dx, BOARD.die, z + dz] as const),
  );
  const p = projectPoints(fit, corners);
  return {
    left: Math.min(...p.map((q) => q.x)),
    right: Math.max(...p.map((q) => q.x)),
    top: Math.min(...p.map((q) => q.y)),
    bottom: Math.max(...p.map((q) => q.y)),
  };
}

describe("홀드 말풍선 자리", () => {
  for (const board of BOARDS) {
    for (const c of CASES) {
      it(`${board.name}, ${c.name}: 말풍선끼리 겹치지 않고 판 영역 안·위쪽 표시 아래에 있으며 판 위에 겹친 것에 가려지지 않는다`, () => {
        const fit = fitCamera(board);

        const boxes = layoutHoldBubbles(fit, c.slots, board.reserveTop).map(bubbleBox);

        for (const [i, a] of boxes.entries()) {
          for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
          expect(a.left).toBeGreaterThanOrEqual(0);
          expect(a.right).toBeLessThanOrEqual(board.width);
          expect(a.top).toBeGreaterThanOrEqual(board.reserveTop);
          expect(a.bottom).toBeLessThanOrEqual(board.height);
          for (const rect of board.avoid) expect(overlaps(a, rect)).toBe(false);
        }
      });
    }
  }

  for (const board of BOARDS) {
    for (const c of CASES) {
      const test = board.knownFaceCover?.includes(c.name) ? it.fails : it;
      test(`${board.name}, ${c.name}: 말풍선은 어느 주사위의 눈(윗면)도 가리지 않는다`, () => {
        const fit = fitCamera(board);
        const faces = c.slots.map((s) => topFace(fit, s));

        for (const bubble of layoutHoldBubbles(fit, c.slots, board.reserveTop)) {
          for (const face of faces) expect(overlaps(bubbleBox(bubble), face)).toBe(false);
        }
      });
    }
  }

  for (const board of BOARDS) {
    for (const c of CASES) {
      it(`${board.name}, ${c.name}: 말풍선은 자기 주사위를 가리킨다(가로 가운데가 그 주사위 윗면 폭 안)`, () => {
        const fit = fitCamera(board);

        for (const bubble of layoutHoldBubbles(fit, c.slots, board.reserveTop)) {
          const own = c.slots.find((s) => s.id === bubble.id);
          if (!own) throw new Error(`주사위 ${bubble.id} 가 없다`);
          const face = topFace(fit, own);
          expect(bubble.x).toBeGreaterThanOrEqual(face.left);
          expect(bubble.x).toBeLessThanOrEqual(face.right);
        }
      });
    }
  }

  for (const board of BOARDS) {
    it(`${board.name}: 다른 주사위를 홀드해도 남은 주사위의 말풍선 자리는 그대로다`, () => {
      const fit = fitCamera(board);
      const allLineup = CASES[0]?.slots ?? [];
      const before = layoutHoldBubbles(fit, allLineup, board.reserveTop);

      // 주사위 2 를 홀드: 같은 열(2)의 홀드 자리로 간다.
      const after = layoutHoldBubbles(
        fit,
        allLineup.map((s) => (s.id === 2 ? { ...s, row: "hold" as const } : s)),
        board.reserveTop,
      );

      expect(after.filter((b) => b.id !== 2)).toEqual(before.filter((b) => b.id !== 2));
    });
  }

  it("홀드 자리의 주사위는 '되돌리기', 정렬 줄의 주사위는 '킵'이다", () => {
    const board = BOARDS[3];
    if (!board) throw new Error("확인 크기가 없다");
    const fit = fitCamera(board);

    const labels = layoutHoldBubbles(fit, CASES[2]?.slots ?? [], board.reserveTop).map((b) => [
      b.id,
      b.label,
    ]);

    expect(labels).toEqual([
      [0, "되돌리기"],
      [1, "킵"],
      [2, "되돌리기"],
      [3, "킵"],
      [4, "되돌리기"],
    ]);
  });
});
