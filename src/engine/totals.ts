import type { Category, PlayerState } from "./types";

const UPPER: readonly Category[] = ["aces", "deuces", "treys", "fours", "fives", "sixes"];

/** 윗칸 여섯 카테고리 점수의 합. */
export function upperSubtotal(player: PlayerState): number {
  return UPPER.reduce((sum, category) => sum + (player.scores[category] ?? 0), 0);
}

/**
 * 총합 득점: 기록한 모든 카테고리 점수의 합.
 * TODO(#6): 윗칸 보너스(+35)를 더한다.
 */
export function totalScore(player: PlayerState): number {
  return Object.values(player.scores).reduce<number>((sum, points) => sum + (points ?? 0), 0);
}
