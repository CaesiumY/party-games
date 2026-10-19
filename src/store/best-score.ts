import { createStoredValue, type KeyValueStorage, type StoredValue } from "./stored-value";

/** 이론상 최대 총합 득점(스펙 「모듈 구조」). 이보다 큰 값은 읽을 수 없는 것으로 버린다. */
const MAX_TOTAL = 325;

/** 이 기기의 최고 점수(연습 모드 총합 득점 가운데 가장 높은 값). */
export function bestScoreValue(storage: KeyValueStorage | null): StoredValue<number> {
  return createStoredValue({
    storage,
    key: "yacht.best-score",
    version: 1,
    parse: (value) =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_TOTAL
        ? value
        : null,
  });
}

/** 연습 모드 한 판의 결과. 결과 화면이 보여 준다. */
export interface PracticeOutcome {
  /** 이번 총합 득점. */
  total: number;
  /** 이번 판까지 반영한 최고 점수. */
  best: number;
  /** 이번 판이 최고 점수를 넘었는지(이 기기의 첫 판이면 언제나 넘은 것이다). */
  isNewBest: boolean;
}

/** 이번 총합 득점을 지난 최고 점수와 견준다. 같으면 넘은 것이 아니다. */
export function settleBest(previous: number | null, total: number): PracticeOutcome {
  const isNewBest = previous === null || total > previous;
  return { total, best: isNewBest ? total : previous, isNewBest };
}
