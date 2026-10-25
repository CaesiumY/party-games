import { type PlayerState, UPPER_CATEGORIES } from "./types";

// 윗칸·아랫칸 목록은 카테고리 목록과 한 곳에서 만든다(./types).
export { LOWER_CATEGORIES, UPPER_CATEGORIES } from "./types";

/** 윗칸 보너스를 받는 소계 기준. 점수표의 "47/63" 표시도 이 값을 쓴다. */
export const UPPER_BONUS_THRESHOLD = 63;

/** 윗칸 보너스 점수. */
export const UPPER_BONUS_POINTS = 35;

/** 윗칸 여섯 카테고리 점수의 합. */
export function upperSubtotal(player: PlayerState): number {
  return UPPER_CATEGORIES.reduce((sum, category) => sum + (player.scores[category] ?? 0), 0);
}

/** 윗칸 보너스: 소계가 63 이상이면 35, 아니면 0. 카테고리가 아니다. */
export function upperBonus(player: PlayerState): number {
  return upperSubtotal(player) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_POINTS : 0;
}

/** 보너스 알림의 문구. "+35" 는 윗칸 보너스를 받음, "+0" 은 윗칸을 다 채웠는데 못 받음. */
export type BonusNotice = "+35" | "+0";

/**
 * 방금 기록으로 띄울 보너스 알림. 기록 전과 뒤의 같은 플레이어를 받는다.
 * 소계가 처음 63 이상이 된 기록이면 "+35", 윗칸의 마지막 칸을 채운 기록인데 63 미만이면 "+0",
 * 그 밖에는 null 이다.
 */
export function bonusNotice(before: PlayerState, after: PlayerState): BonusNotice | null {
  if (upperBonus(before) === 0 && upperBonus(after) > 0) return "+35";
  const filled = (p: PlayerState) =>
    UPPER_CATEGORIES.every((category) => p.scores[category] !== undefined);
  if (!filled(before) && filled(after) && upperBonus(after) === 0) return "+0";
  return null;
}

/** 총합 득점: 기록한 모든 카테고리 점수와 윗칸 보너스의 합. */
export function totalScore(player: PlayerState): number {
  const recorded = Object.values(player.scores).reduce<number>(
    (sum, points) => sum + (points ?? 0),
    0,
  );
  return recorded + upperBonus(player);
}
