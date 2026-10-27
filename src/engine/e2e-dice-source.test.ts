import { describe, expect, it } from "vitest";
import { createE2EDiceSource } from "./e2e-dice-source";

describe("E2E 테스트용 주사위 공급원", () => {
  it("눈은 (플레이어, 턴, 굴림 번호)만으로 정해진다 — 새 공급원이나 다른 굴림 순서에서도 같다", () => {
    const requests = [
      { player: 0, turn: 1, rollNumber: 1, count: 5 },
      { player: 1, turn: 7, rollNumber: 1, count: 5 },
      { player: 0, turn: 1, rollNumber: 2, count: 3 },
      { player: 3, turn: 12, rollNumber: 3, count: 2 },
    ];
    const first = createE2EDiceSource();
    const before = requests.map((r) => first(r));
    const second = createE2EDiceSource();
    const after = [...requests].reverse().map((r) => second(r));
    expect(after.reverse()).toEqual(before);
  });

  it("굴릴 개수만큼만 낸다", () => {
    const source = createE2EDiceSource();
    expect(source({ player: 0, turn: 1, rollNumber: 1, count: 5 })).toEqual([4, 1, 6, 1, 5]);
    expect(source({ player: 0, turn: 1, rollNumber: 2, count: 3 })).toEqual([3, 1, 2]);
    expect(source({ player: 0, turn: 1, rollNumber: 3, count: 2 })).toEqual([3, 2]);
  });

  it("표에 없는 굴림도 1~6 의 눈을 낸다", () => {
    const source = createE2EDiceSource();
    for (let player = 0; player < 4; player += 1) {
      for (let turn = 1; turn <= 12; turn += 1) {
        for (let rollNumber = 1; rollNumber <= 3; rollNumber += 1) {
          const values = source({ player, turn, rollNumber, count: 5 });
          expect(values).toHaveLength(5);
          for (const v of values) expect(v >= 1 && v <= 6).toBe(true);
        }
      }
    }
  });
});
