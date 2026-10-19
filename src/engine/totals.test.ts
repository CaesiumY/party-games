import { describe, expect, it } from "vitest";
import { bonusNotice, totalScore, upperBonus, upperSubtotal } from "./totals";
import type { PlayerState } from "./types";

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

describe("보너스 알림: 방금 기록으로 띄울 알림", () => {
  const player = (scores: PlayerState["scores"]): PlayerState => ({ name: "플레이어 1", scores });

  it("소계가 처음 63 이상이 된 기록이면 +35", () => {
    const before = player({ aces: 3, deuces: 6, treys: 9, fours: 12, fives: 15 });
    const after = player({ ...before.scores, sixes: 18 });

    expect(bonusNotice(before, after)).toBe("+35");
  });

  it("윗칸이 다 차기 전에 63 이상이 되어도 +35", () => {
    const before = player({ fives: 25, sixes: 30 });
    const after = player({ ...before.scores, fours: 16 });

    expect(bonusNotice(before, after)).toBe("+35");
  });

  it("윗칸의 마지막 칸을 채운 기록인데 소계가 63 미만이면 +0", () => {
    const before = player({ aces: 3, deuces: 6, treys: 9, fours: 12, fives: 15, choice: 20 });
    const after = player({ ...before.scores, sixes: 17 });

    expect(bonusNotice(before, after)).toBe("+0");
  });

  it("이미 보너스를 받은 뒤 윗칸의 마지막 칸을 채우면 없음", () => {
    const before = player({ deuces: 10, treys: 15, fours: 20, fives: 25, sixes: 30 });
    const after = player({ ...before.scores, aces: 0 });

    expect(bonusNotice(before, after)).toBeNull();
  });

  it("소계가 63 에 못 미치는 윗칸 기록이나 아랫칸 기록이면 없음", () => {
    const before = player({ aces: 3, deuces: 6 });

    expect(bonusNotice(before, player({ ...before.scores, treys: 9 }))).toBeNull();
    expect(bonusNotice(before, player({ ...before.scores, yacht: 50 }))).toBeNull();
  });

  it("윗칸을 다 채운 뒤의 아랫칸 기록이면 없음", () => {
    const before = player({ aces: 3, deuces: 6, treys: 9, fours: 12, fives: 15, sixes: 17 });

    expect(bonusNotice(before, player({ ...before.scores, choice: 20 }))).toBeNull();
  });
});
