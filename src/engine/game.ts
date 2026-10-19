import type { DiceSource } from "./dice-source";
import { contributingFor, scoreFor } from "./scoring";
import {
  CATEGORIES,
  type Category,
  type CommandResult,
  DIE_IDS,
  type Die,
  type DieId,
  type DieValue,
  type GameState,
  type Rejection,
} from "./types";

/** 게임 시작. 플레이어 이름 목록(1~4명)을 받는다. */
export function startGame(playerNames: readonly string[]): GameState {
  return {
    players: playerNames.map((name) => ({ name, scores: {} })),
    currentPlayer: 0,
    turn: 1,
    rollsUsed: 0,
    dice: DIE_IDS.map((id): Die => ({ id, value: 1, held: false })),
    finished: false,
  };
}

/** 한 턴에 할 수 있는 굴림 횟수. */
export const ROLLS_PER_TURN = 3;

/** 이번 턴에 남은 굴림 횟수. */
export function rollsLeft(state: GameState): number {
  return ROLLS_PER_TURN - state.rollsUsed;
}

/** 지금 굴릴 수 없는 이유. 굴릴 수 있으면 null. */
export function rollRejection(state: GameState): Rejection | null {
  if (state.finished) return "game-over";
  if (rollsLeft(state) <= 0) return "no-rolls-left";
  if (state.dice.every((die) => die.held)) return "all-held";
  return null;
}

/** 지금 이 주사위의 홀드를 바꿀 수 없는 이유. 바꿀 수 있으면 null. */
export function holdRejection(state: GameState, _die: DieId): Rejection | null {
  if (state.finished) return "game-over";
  if (state.rollsUsed === 0) return "not-rolled-yet";
  if (rollsLeft(state) <= 0) return "no-rolls-left";
  return null;
}

/** 홀드 토글. 그 주사위만 홀드하거나 푼다. 눈과 주사위 정체성은 그대로다. */
export function toggleHold(state: GameState, die: DieId): CommandResult {
  const rejection = holdRejection(state, die);
  if (rejection) return { ok: false, reason: rejection };
  const dice = state.dice.map((d) => (d.id === die ? { ...d, held: !d.held } : d));
  return { ok: true, state: { ...state, dice } };
}

/** 굴림. 홀드하지 않은 주사위의 눈을 공급원이 정한 값으로 바꾼다. */
export function roll(state: GameState, source: DiceSource): CommandResult {
  const rejection = rollRejection(state);
  if (rejection) return { ok: false, reason: rejection };
  const free = state.dice.filter((die) => !die.held);
  const values = source({
    player: state.currentPlayer,
    turn: state.turn,
    rollNumber: state.rollsUsed + 1,
    count: free.length,
  });
  let k = 0;
  const dice = state.dice.map((die) =>
    die.held ? die : { ...die, value: values[k++] ?? die.value },
  );
  return { ok: true, state: { ...state, dice, rollsUsed: state.rollsUsed + 1 } };
}

/** 지금 이 카테고리에 기록할 수 없는 이유. 기록할 수 있으면 null. */
export function recordRejection(state: GameState, category: Category): Rejection | null {
  if (state.finished) return "game-over";
  if (state.rollsUsed === 0) return "not-rolled-yet";
  if (state.players[state.currentPlayer]?.scores[category] !== undefined) return "category-filled";
  return null;
}

/** 지금 다섯 주사위의 눈. 주사위 순서(DieId) 그대로다. */
export function currentValues(state: GameState): DieValue[] {
  return state.dice.map((die) => die.value);
}

/**
 * 점수 미리보기: 지금 다섯 눈으로 이 카테고리에 기록하면 받을 점수. 기록도 이 값을 그대로 적는다.
 * 성립하지 않으면 0(스크래치)이다.
 */
export function scorePreview(state: GameState, category: Category): number {
  return scoreFor(category, currentValues(state));
}

/**
 * 기여 주사위: 지금 다섯 눈으로 이 카테고리 점수에 보태는 주사위들. 점수 미리보기와 같은 계산에서 나온다.
 * 스크래치면 빈 배열이다.
 */
export function contributingDice(state: GameState, category: Category): DieId[] {
  // currentValues 는 DieId 순서라 눈 배열의 자리가 곧 DieId 다.
  return contributingFor(category, currentValues(state)) as DieId[];
}

/** 성립 알림 후보. 점수가 같으면 앞의 것을 띄운다(요트 > L. 스트레이트 > 포 다이스 > 풀 하우스 > S. 스트레이트). */
const CALLOUT_CATEGORIES: readonly Category[] = [
  "yacht",
  "lStraight",
  "fourDice",
  "fullHouse",
  "sStraight",
];

/**
 * 성립 알림에 띄울 카테고리: 지금 다섯 눈으로 성립하는 아랫칸 카테고리(초이스 빼고) 가운데 점수가 가장 높은 하나.
 * 이미 기록한 카테고리여도 띄운다(굴림 결과를 축하하는 표시). 아무것도 성립하지 않으면 null.
 */
export function comboCallout(state: GameState): Category | null {
  let best: Category | null = null;
  let bestPoints = 0;
  for (const category of CALLOUT_CATEGORIES) {
    const points = scorePreview(state, category);
    if (points > bestPoints) {
      best = category;
      bestPoints = points;
    }
  }
  return best;
}

/** 기록. 현재 플레이어의 빈 카테고리에 점수 미리보기 값을 적는다. */
export function record(state: GameState, category: Category): CommandResult {
  const rejection = recordRejection(state, category);
  if (rejection) return { ok: false, reason: rejection };
  const points = scorePreview(state, category);
  const players = state.players.map((player, i) =>
    i === state.currentPlayer
      ? { ...player, scores: { ...player.scores, [category]: points } }
      : player,
  );
  const recorded = { ...state, players };
  if (allScorecardsFull(recorded)) return { ok: true, state: { ...recorded, finished: true } };
  return { ok: true, state: nextTurn(recorded) };
}

/** 모든 플레이어의 점수표가 다 찼는지. 다 차면 게임이 끝난다. */
function allScorecardsFull(state: GameState): boolean {
  return state.players.every((player) =>
    CATEGORIES.every((category) => player.scores[category] !== undefined),
  );
}

/** 게임 모드. 따로 저장하지 않고 플레이어 수로 정한다(1명이면 연습 모드, 2~4명이면 대전 모드). */
export function gameMode(state: GameState): "practice" | "versus" {
  return state.players.length === 1 ? "practice" : "versus";
}

/** 기록 뒤 다음 차례로 넘긴다. 마지막 플레이어까지 돌면 턴 번호가 오른다. 홀드는 모두 풀린다. */
function nextTurn(state: GameState): GameState {
  const wrapped = state.currentPlayer + 1 >= state.players.length;
  return {
    ...state,
    currentPlayer: wrapped ? 0 : state.currentPlayer + 1,
    turn: wrapped ? state.turn + 1 : state.turn,
    rollsUsed: 0,
    dice: state.dice.map((die) => ({ ...die, held: false })),
  };
}
