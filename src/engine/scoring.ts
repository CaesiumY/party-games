import type { Category, DieValue } from "./types";

type Scorer = (values: readonly DieValue[]) => number;

const sum: Scorer = (values) => values.reduce<number>((total, v) => total + v, 0);

/**
 * 카테고리별 점수 계산. 점수 미리보기와 실제 기록이 모두 이 표를 쓴다(스펙 「점수 계산은 한 곳에서만」).
 * 아직 들어오지 않은 카테고리는 표에 없다(#6 에서 채운다).
 */
const SCORERS: Partial<Record<Category, Scorer>> = {
  choice: sum,
};

/** 이 카테고리의 점수 계산이 들어와 있는지. 없으면 기록할 수 없다. */
export function isScorable(category: Category): boolean {
  return SCORERS[category] !== undefined;
}

/** 다섯 눈으로 이 카테고리에 기록하면 받을 점수. 계산이 없는 카테고리면 undefined. */
export function scoreFor(category: Category, values: readonly DieValue[]): number | undefined {
  return SCORERS[category]?.(values);
}
