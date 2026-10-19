import { describe, expect, it } from "vitest";
import { totalScore, upperBonus, upperSubtotal } from "./totals";

describe("소계와 총합 득점", () => {
  it("아랫칸만 기록했으면 소계는 0이고 총합 득점은 기록한 점수의 합이다", () => {
    const player = { name: "플레이어 1", scores: { choice: 24 } };

    expect(upperSubtotal(player)).toBe(0);
    expect(totalScore(player)).toBe(24);
  });

  it("아무것도 기록하지 않았으면 0점이다", () => {
    expect(totalScore({ name: "플레이어 1", scores: {} })).toBe(0);
  });
});

describe("윗칸 보너스", () => {
  // 3·6·9·12·15 = 45 에 식스 17 이면 62, 18 이면 63.
  const upperWithSixes = (sixes: number) => ({
    name: "플레이어 1",
    scores: { aces: 3, deuces: 6, treys: 9, fours: 12, fives: 15, sixes, choice: 20 },
  });

  it("소계가 62면 보너스가 없다", () => {
    const player = upperWithSixes(17);

    expect(upperSubtotal(player)).toBe(62);
    expect(upperBonus(player)).toBe(0);
    expect(totalScore(player)).toBe(82);
  });

  it("소계가 63이면 +35가 총합 득점에 더해진다", () => {
    const player = upperWithSixes(18);

    expect(upperSubtotal(player)).toBe(63);
    expect(upperBonus(player)).toBe(35);
    expect(totalScore(player)).toBe(118);
  });
});
