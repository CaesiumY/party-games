import type { Category } from "../engine/types";

/** 카테고리 화면 이름. 「세계 게임전집 51」 한국어판 표기 그대로(용어집). */
export const CATEGORY_NAMES: Record<Category, string> = {
  aces: "에이스",
  deuces: "듀스",
  treys: "트레이",
  fours: "포",
  fives: "파이브",
  sixes: "식스",
  choice: "초이스",
  fourDice: "포 다이스",
  fullHouse: "풀 하우스",
  sStraight: "S. 스트레이트",
  lStraight: "L. 스트레이트",
  yacht: "요트",
};
