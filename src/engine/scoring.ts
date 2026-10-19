import type { Category, DieValue } from "./types";

type Scorer = (values: readonly DieValue[]) => number;

const sum: Scorer = (values) => values.reduce<number>((total, v) => total + v, 0);

/** 윗칸: 그 눈을 가진 주사위의 눈만 더한다. */
const eyes =
  (face: DieValue): Scorer =>
  (values) =>
    sum(values.filter((v) => v === face));

/** 눈마다 몇 개씩 나왔는지. 큰 수부터. 예: 66625 → [3, 1, 1] */
function groupSizes(values: readonly DieValue[]): number[] {
  const counts = new Map<DieValue, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
}

/** 서로 다른 눈 가운데 가장 길게 이어지는 개수. 중복된 눈은 하나로 센다. 예: 11234 → 4 */
function longestRun(values: readonly DieValue[]): number {
  const faces = new Set(values);
  let best = 0;
  let run = 0;
  for (let face = 1; face <= 6; face++) {
    run = faces.has(face as DieValue) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** 조건이 맞으면 점수, 아니면 0(스크래치). */
const fixedIf =
  (points: number, holds: (values: readonly DieValue[]) => boolean): Scorer =>
  (values) =>
    holds(values) ? points : 0;

/** 조건이 맞으면 다섯 눈 전체의 합, 아니면 0(스크래치). */
const sumIf =
  (holds: (values: readonly DieValue[]) => boolean): Scorer =>
  (values) =>
    holds(values) ? sum(values) : 0;

/**
 * 카테고리별 점수 계산. 점수 미리보기와 실제 기록이 모두 이 표를 쓴다(스펙 「점수 계산은 한 곳에서만」).
 */
const SCORERS: Record<Category, Scorer> = {
  aces: eyes(1),
  deuces: eyes(2),
  treys: eyes(3),
  fours: eyes(4),
  fives: eyes(5),
  sixes: eyes(6),
  choice: sum,
  fourDice: sumIf((values) => (groupSizes(values)[0] ?? 0) >= 4),
  fullHouse: sumIf((values) => {
    const sizes = groupSizes(values).join("+");
    return sizes === "3+2" || sizes === "5";
  }),
  sStraight: fixedIf(15, (values) => longestRun(values) >= 4),
  lStraight: fixedIf(30, (values) => longestRun(values) >= 5),
  yacht: fixedIf(50, (values) => groupSizes(values)[0] === 5),
};

/** 다섯 눈으로 이 카테고리에 기록하면 받을 점수. 조건이 맞지 않으면 0(스크래치)이다. */
export function scoreFor(category: Category, values: readonly DieValue[]): number {
  return SCORERS[category](values);
}
