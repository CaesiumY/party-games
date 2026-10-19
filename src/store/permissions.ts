import { holdRejection, recordRejection, rollRejection, rollsLeft } from "../engine/game";
import type { Category, DieId, GameState, Rejection } from "../engine/types";

/**
 * 굴림 연출이 어디까지 왔는지. 연출 입구(src/scene/roll-presenter.ts)가 알리는 시점으로 바뀐다.
 * - idle: 연출 중이 아님
 * - rolling: 굴림 버튼을 누른 뒤 멈춤 전
 * - stopped: 멈춤 뒤 정렬 끝 전(점수 미리보기는 보이지만 조작은 아직 막힘)
 * - auto-moving: 3번째 굴림의 정렬 끝 뒤, 정렬 줄의 주사위가 홀드 자리로 올라가는 중(모든 조작을 막음)
 */
export type Presentation =
  | { phase: "idle" }
  | { phase: "rolling" | "stopped" | "auto-moving"; rollId: number };

/**
 * 저장소가 거부한 이유. 엔진의 거부 이유에 화면 쪽 이유를 더한 것이다.
 * - presenting: 굴림 연출 중
 * - moving: 홀드·홀드 풀기로 주사위가 옮겨 가는 중
 */
export type StoreRejection = Rejection | "presenting" | "moving" | "no-selection";

export type ActionResult = { ok: true } | { ok: false; reason: StoreRejection };

export interface JudgeInput {
  game: GameState;
  presentation: Presentation;
  selection: Category | null;
  /** 홀드·홀드 풀기로 자리를 옮겨 가는 중인 주사위. 연출 입구가 다 옮겼다고 알리면 빠진다. */
  movingDice: readonly DieId[];
}

/**
 * 조작 가능 여부를 판정하는 단 하나의 자리(스펙 「게임 상태 저장소」).
 * 저장소 명령도, 버튼의 활성 상태도 이 판정을 쓴다. 규칙 자체는 엔진의 판정에 맡기고,
 * 여기서는 연출 중인지·선택했는지 같은 화면 쪽 조건만 더한다.
 */
export function rollBlocker(s: JudgeInput): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  if (s.movingDice.length > 0) return "moving";
  return rollRejection(s.game);
}

export function selectBlocker(s: JudgeInput, category: Category): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  return recordRejection(s.game, category);
}

export function recordBlocker(s: JudgeInput): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  if (s.movingDice.length > 0) return "moving";
  if (s.selection === null) return "no-selection";
  return recordRejection(s.game, s.selection);
}

/**
 * 홀드 토글을 받을 수 있는지. 굴림 버튼을 누른 때부터 정렬 끝까지는 막는다.
 * 홀드·홀드 풀기로 옮겨 가는 중인 그 주사위만 막고, 다른 주사위는 연달아 홀드할 수 있다.
 */
export function holdBlocker(s: JudgeInput, die: DieId): StoreRejection | null {
  if (s.presentation.phase !== "idle") return "presenting";
  if (s.movingDice.includes(die)) return "moving";
  return holdRejection(s.game, die);
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

/**
 * 3번째 굴림의 정렬이 끝나 다섯 개가 모두 홀드 자리에 놓이는 상태인지(스펙 「3D 장면」).
 * 올라가는 이동 중(auto-moving)에도 참이다. 연출 입구는 이 자리를 보고 주사위를 옮긴다.
 * 표현일 뿐이라 엔진의 홀드 상태는 바꾸지 않는다. 굴림 연출 동안은 엔진의 홀드 그대로 보여 준다.
 */
export function allDiceUp(s: Pick<JudgeInput, "game" | "presentation">): boolean {
  const { phase } = s.presentation;
  return (
    s.game.rollsUsed > 0 && rollsLeft(s.game) <= 0 && (phase === "idle" || phase === "auto-moving")
  );
}

/** 점수 미리보기는 주사위가 멈추는 순간부터 보인다. 조작 잠금은 정렬 끝에 풀린다. */
export function previewVisible(s: Pick<JudgeInput, "game" | "presentation">): boolean {
  return s.game.rollsUsed > 0 && s.presentation.phase !== "rolling";
}
