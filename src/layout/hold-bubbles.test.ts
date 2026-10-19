import { describe, expect, it } from "vitest";
import { BOARD, columnX } from "./board";
import { fitCamera, projectPoints } from "./camera-fit";
import type { DieSlot } from "./columns";
import { type BubbleBox, bubbleBox, layoutHoldBubbles } from "./hold-bubbles";

/** 확인 크기 네 곳(4인 대전)의 판 영역 크기와 위쪽 표시 자리. 시안 v6 실측값에 가깝게. */
const BOARDS = [
  { name: "375×667 세로", width: 343, height: 284, reserveTop: 32 },
  { name: "667×375 가로", width: 373, height: 311, reserveTop: 32 },
  { name: "1024×768 가로", width: 643, height: 698, reserveTop: 34 },
  { name: "1280×720 가로", width: 812, height: 653, reserveTop: 34 },
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
      it(`${board.name}, ${c.name}: 말풍선끼리 겹치지 않고 판 영역 안·위쪽 표시 아래에 있다`, () => {
        const fit = fitCamera({ ...board, avoid: [] });

        const boxes = layoutHoldBubbles(fit, c.slots, board.reserveTop).map(bubbleBox);

        for (const [i, a] of boxes.entries()) {
          for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
          expect(a.left).toBeGreaterThanOrEqual(0);
          expect(a.right).toBeLessThanOrEqual(board.width);
          expect(a.top).toBeGreaterThanOrEqual(board.reserveTop);
          expect(a.bottom).toBeLessThanOrEqual(board.height);
        }
      });
    }
  }

  for (const board of BOARDS) {
    for (const c of CASES) {
      it(`${board.name}, ${c.name}: 말풍선은 어느 주사위의 눈(윗면)도 가리지 않는다`, () => {
        const fit = fitCamera({ ...board, avoid: [] });
        const faces = c.slots.map((s) => topFace(fit, s));

        for (const bubble of layoutHoldBubbles(fit, c.slots, board.reserveTop)) {
          for (const face of faces) expect(overlaps(bubbleBox(bubble), face)).toBe(false);
        }
      });
    }
  }

  for (const board of BOARDS) {
    it(`${board.name}: 다른 주사위를 홀드해도 남은 주사위의 말풍선 자리는 그대로다`, () => {
      const fit = fitCamera({ ...board, avoid: [] });
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
    const fit = fitCamera({ ...board, avoid: [] });

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
