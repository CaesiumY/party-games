import type { DieValue } from "./types";

/** 공급원이 굴림 결과를 정할 때 받는 정보. */
export interface RollRequest {
  /** 굴리는 플레이어의 순번(0부터). */
  player: number;
  /** 턴 번호(1부터). */
  turn: number;
  /** 이번 턴의 몇 번째 굴림인지(1부터). */
  rollNumber: number;
  /** 굴릴 주사위 개수. 홀드하지 않은 주사위 수와 같다. */
  count: number;
}

/**
 * 굴림 결과를 만드는 공급원. 게임 엔진은 이것을 바깥에서 주입받는다(ADR-0001).
 * `count` 개의 눈을 돌려준다.
 */
export type DiceSource = (request: RollRequest) => DieValue[];

/**
 * 테스트용 공급원: 정해 둔 눈 목록을 굴림마다 하나씩 차례로 낸다.
 * 굴릴 개수보다 목록이 길면 앞에서부터 그 개수만 쓴다.
 */
export function scriptedDiceSource(rolls: readonly (readonly DieValue[])[]): DiceSource {
  let next = 0;
  return ({ count }) => {
    const values = rolls[next];
    if (!values) throw new Error(`정해 둔 굴림이 ${rolls.length}번뿐인데 더 굴렸다`);
    if (values.length < count) {
      throw new Error(`${count}개를 굴려야 하는데 정해 둔 눈은 ${values.length}개다`);
    }
    next += 1;
    return values.slice(0, count);
  };
}
