import { scoreFor } from "./scoring";
import type { Category, DieValue } from "./types";

export interface RuleExample {
  category: Category;
  dice: readonly DieValue[];
  /** 이 주사위로 그 카테고리에 기록하면 받을 점수. 점수 계산 표(scoring.ts)로 셈한다. */
  score: number;
}

/**
 * 플레이 방법 「족보」 탭의 예시 주사위(스펙 「플레이 방법 화면」). 점수표 순서다.
 * 모두 그 카테고리가 성립하는 주사위다. 풀 하우스는 같은 눈 5개도 인정한다는 예시를 하나 더 둔다.
 */
const EXAMPLES: readonly [Category, readonly DieValue[]][] = [
  ["aces", [1, 1, 3, 4, 6]],
  ["deuces", [2, 2, 2, 5, 6]],
  ["treys", [1, 3, 3, 4, 6]],
  ["fours", [2, 4, 4, 5, 6]],
  ["fives", [1, 5, 5, 5, 6]],
  ["sixes", [2, 3, 6, 6, 6]],
  ["choice", [2, 3, 4, 6, 6]],
  ["fourDice", [3, 3, 3, 3, 5]],
  ["fullHouse", [2, 2, 5, 5, 5]],
  ["fullHouse", [6, 6, 6, 6, 6]],
  ["sStraight", [1, 2, 3, 4, 6]],
  ["lStraight", [2, 3, 4, 5, 6]],
  ["yacht", [4, 4, 4, 4, 4]],
];

/** 족보 예시와 그 점수. 점수를 손으로 적지 않아서 규칙과 설명이 어긋나지 않는다. */
export function ruleExamples(): RuleExample[] {
  return EXAMPLES.map(([category, dice]) => ({ category, dice, score: scoreFor(category, dice) }));
}
