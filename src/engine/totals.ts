import type { Category, PlayerState } from "./types";

const UPPER: readonly Category[] = ["aces", "deuces", "treys", "fours", "fives", "sixes"];

/** 윗칸 보너스를 받는 소계 기준. 점수표의 "47/63" 표시도 이 값을 쓴다. */
export const UPPER_BONUS_THRESHOLD = 63;

/** 윗칸 보너스 점수. */
export const UPPER_BONUS_POINTS = 35;

/** 윗칸 여섯 카테고리 점수의 합. */
export function upperSubtotal(player: PlayerState): number {
  return UPPER.reduce((sum, category) => sum + (player.scores[category] ?? 0), 0);
}

/** 윗칸 보너스: 소계가 63 이상이면 35, 아니면 0. 카테고리가 아니다. */
export function upperBonus(player: PlayerState): number {
  return upperSubtotal(player) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_POINTS : 0;
}

/** 총합 득점: 기록한 모든 카테고리 점수와 윗칸 보너스의 합. */
export function totalScore(player: PlayerState): number {
  const recorded = Object.values(player.scores).reduce<number>(
    (sum, points) => sum + (points ?? 0),
    0,
  );
  return recorded + upperBonus(player);
}
