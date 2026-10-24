import { describe, expect, it } from "vitest";
import type { Die, DieValue } from "../engine/types";
import { diceSlots, lineupColumns, screenOrder } from "./columns";

const dice = (values: DieValue[], held: number[] = []): Die[] =>
  values.map((value, i) => ({ id: i as Die["id"], value, held: held.includes(i) }));

/** 열 순서(왼쪽부터)로 늘어놓은 눈. */
function valuesByColumn(d: readonly Die[], columns: readonly number[]): number[] {
  const out: number[] = [];
  for (const die of d) out[columns[die.id] ?? -1] = die.value;
  return out;
}

describe("정렬 줄의 열", () => {
  it("굴림이 끝나면 눈 오름차순으로 왼쪽 열부터 놓인다", () => {
    // 주사위 0..4 의 눈이 5,1,4,1,3 이면 열은 1·1·3·4·5 순서가 된다.
    expect(lineupColumns(dice([5, 1, 4, 1, 3]))).toEqual([4, 0, 3, 1, 2]);
  });

  it("3번째 전 굴림이 끝나면 홀드한 주사위는 왼쪽 열부터, 나머지는 그 오른쪽 열부터 각각 오름차순이다", () => {
    // 홀드 6·2, 다시 굴린 5·1·3
    const d = dice([6, 5, 2, 1, 3], [0, 2]);

    const columns = lineupColumns(d);

    expect(valuesByColumn(d, columns)).toEqual([2, 6, 1, 3, 5]);
    expect([columns[2], columns[0]]).toEqual([0, 1]);
  });

  it("3번째 굴림이 끝나면 홀드한 것과 새로 굴린 것을 합쳐 다섯 개 모두 왼쪽 열부터 오름차순이다", () => {
    // 홀드 5·5·6 + 굴림 1·2 → 1·2·5·5·6
    const d = dice([5, 1, 6, 2, 5], [0, 2, 4]);

    const columns = lineupColumns(d, { finalRoll: true });

    expect(valuesByColumn(d, columns)).toEqual([1, 2, 5, 5, 6]);
  });
});

describe("주사위가 놓이는 줄", () => {
  it("홀드한 주사위는 홀드 자리, 나머지는 정렬 줄에 자기 열 그대로 놓인다", () => {
    const d = dice([6, 5, 2, 1, 3], [0, 2]);
    const columns = [1, 4, 0, 2, 3];

    expect(diceSlots(d, columns, { allUp: false })).toEqual([
      { id: 0, column: 1, row: "hold" },
      { id: 1, column: 4, row: "lineup" },
      { id: 2, column: 0, row: "hold" },
      { id: 3, column: 2, row: "lineup" },
      { id: 4, column: 3, row: "lineup" },
    ]);
  });

  it("홀드와 홀드 풀기는 그 주사위의 줄만 바꾸고, 열과 다른 주사위는 그대로 둔다", () => {
    const columns = [1, 4, 0, 2, 3];
    const before = diceSlots(dice([6, 5, 2, 1, 3], [0, 2]), columns, { allUp: false });

    const held = diceSlots(dice([6, 5, 2, 1, 3], [0, 2, 3]), columns, { allUp: false });
    const released = diceSlots(dice([6, 5, 2, 1, 3], [2]), columns, { allUp: false });

    const changed = (after: typeof before) =>
      after.filter((slot, i) => JSON.stringify(slot) !== JSON.stringify(before[i]));
    expect(changed(held)).toEqual([{ id: 3, column: 2, row: "hold" }]);
    expect(changed(released)).toEqual([{ id: 0, column: 1, row: "lineup" }]);
  });

  it("3번째 굴림 뒤에는 홀드 여부와 상관없이 다섯 개 모두 홀드 자리에 놓인다", () => {
    const slots = diceSlots(dice([5, 1, 6, 2, 5], [0, 2, 4]), [2, 0, 4, 1, 3], { allUp: true });

    expect(slots.map((s) => s.row)).toEqual(["hold", "hold", "hold", "hold", "hold"]);
    expect(slots.map((s) => s.column)).toEqual([2, 0, 4, 1, 3]);
  });
});

describe("화면 순서", () => {
  it("홀드 자리의 주사위들, 그다음 정렬 줄의 주사위들, 각각 왼쪽 열부터다", () => {
    const slots = diceSlots(dice([6, 5, 2, 1, 3], [0, 2]), [1, 4, 0, 2, 3], { allUp: false });

    expect(screenOrder(slots)).toEqual([2, 0, 3, 4, 1]);
  });
});
