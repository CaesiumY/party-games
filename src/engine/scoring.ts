import type { Category, DieValue } from "./types";

/**
 * 한 카테고리의 계산 결과. 점수와, 그 점수에 보태는 주사위(기여 주사위)의 순번.
 * 순번은 받은 눈 배열의 자리다. 스크래치(0점)면 기여 주사위가 없다.
 */
interface Scored {
  points: number;
  dice: number[];
}

type Scorer = (values: readonly DieValue[]) => Scored;

const SCRATCH: Scored = { points: 0, dice: [] };

const sum = (values: readonly DieValue[]): number =>
  values.reduce<number>((total, v) => total + v, 0);

const allDice = (values: readonly DieValue[]): number[] => values.map((_, i) => i);

/** 윗칸: 그 눈을 가진 주사위의 눈만 더한다. 기여 주사위도 그 눈의 주사위들이다. */
const eyes =
  (face: DieValue): Scorer =>
  (values) => {
    const dice = allDice(values).filter((i) => values[i] === face);
    return { points: face * dice.length, dice };
  };

/** 눈마다 몇 개씩 나왔는지. 큰 수부터. 예: 66625 → [3, 1, 1] */
function groupSizes(values: readonly DieValue[]): number[] {
  const counts = new Map<DieValue, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
}

/**
 * 서로 다른 눈 `length` 개가 이어지는 가장 낮은 줄의 주사위 순번(작은 순번부터).
 * 중복된 눈은 앞 순번의 주사위 하나만 쓴다.
 * 없으면 null. 예: 11234 에서 4개 → [0, 2, 3, 4](눈 1·2·3·4)
 */
function run(values: readonly DieValue[], length: number): number[] | null {
  for (let start = 1; start + length - 1 <= 6; start++) {
    const dice: number[] = [];
    for (let face = start; face < start + length; face++) {
      const i = values.indexOf(face as DieValue);
      if (i < 0) break;
      dice.push(i);
    }
    if (dice.length === length) return dice.sort((a, b) => a - b);
  }
  return null;
}

/** 조건이 맞으면 다섯 눈 전체의 합(다섯 개 모두 기여), 아니면 스크래치. */
const sumIf =
  (holds: (values: readonly DieValue[]) => boolean): Scorer =>
  (values) =>
    holds(values) ? { points: sum(values), dice: allDice(values) } : SCRATCH;

/** 서로 다른 눈 `length` 개가 이어지면 고정 점수(이어진 주사위들이 기여), 아니면 스크래치. */
const straight =
  (points: number, length: number): Scorer =>
  (values) => {
    const dice = run(values, length);
    return dice ? { points, dice } : SCRATCH;
  };

/**
 * 카테고리별 점수와 기여 주사위. 점수 미리보기·실제 기록·기여 주사위가 모두 이 표를 쓴다
 * (스펙 「점수 계산은 한 곳에서만」).
 */
const SCORERS: Record<Category, Scorer> = {
  aces: eyes(1),
  deuces: eyes(2),
  treys: eyes(3),
  fours: eyes(4),
  fives: eyes(5),
  sixes: eyes(6),
  choice: (values) => ({ points: sum(values), dice: allDice(values) }),
  fourDice: sumIf((values) => (groupSizes(values)[0] ?? 0) >= 4),
  fullHouse: sumIf((values) => {
    const sizes = groupSizes(values).join("+");
    return sizes === "3+2" || sizes === "5";
  }),
  sStraight: straight(15, 4),
  lStraight: straight(30, 5),
  yacht: (values) =>
    groupSizes(values)[0] === 5 ? { points: 50, dice: allDice(values) } : SCRATCH,
};

/** 다섯 눈으로 이 카테고리에 기록하면 받을 점수. 조건이 맞지 않으면 0(스크래치)이다. */
export function scoreFor(category: Category, values: readonly DieValue[]): number {
  return SCORERS[category](values).points;
}

/**
 * 기여 주사위: 이 카테고리 점수에 보태는 주사위의 순번(받은 눈 배열의 자리, 작은 순번부터).
 * 에이스~식스는 그 눈의 주사위들, S. 스트레이트는 이어진 네 눈의 주사위 하나씩
 * (다섯 눈이 이어지면 낮은 쪽 네 개), 나머지는 성립하면 다섯 개 전부다. 스크래치면 빈 배열이다.
 */
export function contributingFor(category: Category, values: readonly DieValue[]): number[] {
  return SCORERS[category](values).dice;
}
