import { describe, expect, it } from "vitest";
import { totalScore, upperSubtotal } from "./totals";

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
