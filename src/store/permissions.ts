import { holdRejection, recordRejection, rollRejection, rollsLeft } from "../engine/game";
import type { Category, DieId, GameState, Rejection } from "../engine/types";

/**
 * 굴림 연출이 어디까지 왔는지. 연출 입구(src/scene/roll-presenter.ts)가 알리는 두 시점으로 바뀐다.
 * - idle: 연출 중이 아님
 * - rolling: 굴림 버튼을 누른 뒤 멈춤 전
 * - stopped: 멈춤 뒤 정렬 끝 전(점수 미리보기는 보이지만 조작은 아직 막힘)
 */
export type Presentation = { phase: "idle" } | { phase: "rolling" | "stopped"; rollId: number };

/** 저장소가 거부한 이유. 엔진의 거부 이유에 화면 쪽 이유를 더한 것이다. */
export type StoreRejection = Rejection | "presenting" | "no-selection";

export type ActionResult = { ok: true } | { ok: false; reason: StoreRejection };

export interface JudgeInput {
  game: GameState;
  presentation: Presentation;
  selection: Category | null;
}

/**
 * 조작 가능 여부를 판정하는 단 하나의 자리(스펙 「게임 상태 저장소」).
 * 저장소 명령도, 버튼의 활성 상태도 이 판정을 쓴다. 규칙 자체는 엔진의 판정에 맡기고,
 * 여기서는 연출 중인지·선택했는지 같은 화면 쪽 조건만 더한다.
 */
export function rollBlocker(s: JudgeInput): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  return rollRejection(s.game);
}

export function selectBlocker(s: JudgeInput, category: Category): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  return recordRejection(s.game, category);
}

export function recordBlocker(s: JudgeInput): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  if (s.selection === null) return "no-selection";
  return recordRejection(s.game, s.selection);
}

/** 홀드 토글을 받을 수 있는지. 굴림 버튼을 누른 때부터 정렬 끝까지는 막는다. */
export function holdBlocker(s: JudgeInput, die: DieId): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  return holdRejection(s.game, die);
}

/**
 * 플레이 방법("?" 버튼)을 열 수 있는지(스펙 「게임 상태 저장소」). 연 사이에 화면이 바뀌면
 * 닫았을 때 연 때와 다른 화면이 되므로, 무엇이 움직이고 있는 동안에는 막는다.
 *
 * - 굴림 연출과 3번째 굴림 뒤 자동 이동: 연출 단계가 idle 이 아니면 막는다. 단계 이름을 하나하나 보지 않아서
 *   자동 이동 단계(#11)가 `Presentation` 에 더해지면 그대로 막힌다. 지금의 순간 배치는 자동 이동이
 *   정렬 끝과 함께 끝난다. 주사위 하나의 홀드 이동은 연출 단계가 아니라서 막지 않는다.
 * - 보너스 알림(#13)·차례 배너(#9)가 떠 있는 동안: 그 표시 상태가 JudgeInput 에 생기면 여기에 더한다.
 */
export function helpBlocker(s: JudgeInput): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  return null;
}

export interface Permissions {
  canRoll: boolean;
  canRecord: boolean;
  canSelect(category: Category): boolean;
  canHold(die: DieId): boolean;
  /** 점수표 머리의 "?" 버튼으로 플레이 방법을 열 수 있는지. */
  canOpenHelp: boolean;
}

export function judge(s: JudgeInput): Permissions {
  return {
    canRoll: rollBlocker(s) === null,
    canRecord: recordBlocker(s) === null,
    canSelect: (category) => selectBlocker(s, category) === null,
    canHold: (die) => holdBlocker(s, die) === null,
    canOpenHelp: helpBlocker(s) === null,
  };
}

/**
 * 3번째 굴림의 정렬이 끝나 다섯 개가 모두 홀드 자리로 올라간 상태인지(스펙 「3D 장면」).
 * 표현일 뿐이라 엔진의 홀드 상태는 바꾸지 않는다. 굴림 연출 동안은 엔진의 홀드 그대로 보여 준다.
 */
export function allDiceUp(s: JudgeInput): boolean {
  return s.game.rollsUsed > 0 && rollsLeft(s.game) <= 0 && s.presentation.phase === "idle";
}

/** 점수 미리보기는 주사위가 멈추는 순간부터 보인다. 조작 잠금은 정렬 끝에 풀린다. */
export function previewVisible(s: JudgeInput): boolean {
  return s.game.rollsUsed > 0 && s.presentation.phase !== "rolling";
}
