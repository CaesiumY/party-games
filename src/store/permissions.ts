import { recordRejection, rollRejection, rollsLeft } from "../engine/game";
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

/** 홀드 토글을 받을 수 있는지. 홀드 명령 자체는 #7 이 엔진에 더한다. */
export function holdBlocker(s: JudgeInput, _die: DieId): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  if (s.game.rollsUsed === 0) return "not-rolled-yet";
  if (rollsLeft(s.game) <= 0) return "no-rolls-left";
  return null;
}

export interface Permissions {
  canRoll: boolean;
  canRecord: boolean;
  canSelect(category: Category): boolean;
  canHold(die: DieId): boolean;
}

export function judge(s: JudgeInput): Permissions {
  return {
    canRoll: rollBlocker(s) === null,
    canRecord: recordBlocker(s) === null,
    canSelect: (category) => selectBlocker(s, category) === null,
    canHold: (die) => holdBlocker(s, die) === null,
  };
}

/** 점수 미리보기는 주사위가 멈추는 순간부터 보인다. 조작 잠금은 정렬 끝에 풀린다. */
export function previewVisible(s: JudgeInput): boolean {
  return s.game.rollsUsed > 0 && s.presentation.phase !== "rolling";
}
