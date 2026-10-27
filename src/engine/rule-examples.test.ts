import { describe, expect, it } from "vitest";
import { ruleExamples } from "./rule-examples";
import { CATEGORIES } from "./types";

/** 예시 주사위를 "11346 → 2" 처럼 읽는다. 기대값은 손으로 셈한 값이다. */
const read = () =>
  ruleExamples().map(({ category, dice, score }) => `${category} ${dice.join("")} → ${score}`);

describe("플레이 방법의 족보 예시", () => {
  it("12개 카테고리마다 예시 주사위가 있다", () => {
    const covered = new Set(ruleExamples().map((example) => example.category));

    expect([...covered]).toEqual([...CATEGORIES]);
  });

  it("표시하는 점수가 엔진의 점수 계산과 같다", () => {
    expect(read()).toEqual([
      "aces 11346 → 2",
      "deuces 22256 → 6",
      "treys 13346 → 6",
      "fours 24456 → 8",
      "fives 15556 → 15",
      "sixes 23666 → 18",
      "choice 23466 → 21",
      "fourDice 33335 → 17",
      "fullHouse 22555 → 19",
      "fullHouse 66666 → 30",
      "sStraight 12346 → 15",
      "lStraight 23456 → 30",
      "yacht 44444 → 50",
    ]);
  });
});
