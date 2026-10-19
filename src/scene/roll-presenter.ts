import type { ComponentType } from "react";
import type { DieId, DieValue } from "../engine/types";

/**
 * 연출 입구가 받는 주사위 하나. 굴림 결과(눈)와 홀드 상태, 정렬이 끝났을 때의 열.
 * `held` 는 그 주사위가 홀드 자리에 놓이는지다. 굴림(`rollId` 가 바뀐 때)에는 엔진의 홀드 그대로라
 * 홀드하지 않은 주사위만 컵에 넣으면 된다. 3번째 굴림의 정렬 끝 뒤에는 굴림이 아닌 갱신으로
 * 다섯 개 모두 `held: true` 가 된다(정렬 줄의 주사위가 같은 열의 홀드 자리로 올라감).
 */
export interface PresentedDie {
  id: DieId;
  value: DieValue;
  held: boolean;
  column: number;
}

/**
 * 굴림 연출 입구(스펙 「굴림 연출」). 연출 구현은 모두 이 props 를 받는 R3F 컴포넌트다.
 *
 * - `rollId` 가 바뀌면 새 굴림이다. 그 굴림의 결과는 이미 `dice` 에 정해져 있다(ADR-0001).
 *   연출은 결과를 바꾸지 않고, 멈춘 면을 읽어 점수에 반영하지도 않는다.
 * - 주사위가 멈추면 `onStopped(rollId)`, 정렬 줄·홀드 자리에 다 놓이면 `onLinedUp(rollId)` 를 한 번씩 부른다.
 *   점수 미리보기는 멈춤에서, 조작 잠금 해제는 정렬 끝에서 일어난다.
 * - 굴림이 아닐 때(홀드 토글, 화면 회전 등)는 `dice` 의 열·홀드 상태대로 주사위를 그려 두기만 한다.
 * - `rollId` 0 은 아직 굴림이 없다는 뜻이다. 알리지 않는다.
 */
export interface RollPresenterProps {
  rollId: number;
  dice: readonly PresentedDie[];
  onStopped(rollId: number): void;
  onLinedUp(rollId: number): void;
}

export type RollPresenter = ComponentType<RollPresenterProps>;
