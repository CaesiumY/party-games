import type { DiceSource } from "./dice-source";
import { isScorable, scoreFor } from "./scoring";
import {
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
  if (rollsLeft(state) <= 0) return "no-rolls-left";
  if (state.dice.every((die) => die.held)) return "all-held";
  return null;
}

/** 지금 이 주사위의 홀드를 바꿀 수 없는 이유. 바꿀 수 있으면 null. */
export function holdRejection(state: GameState, _die: DieId): Rejection | null {
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
  if (state.rollsUsed === 0) return "not-rolled-yet";
  if (state.players[state.currentPlayer]?.scores[category] !== undefined) return "category-filled";
  if (!isScorable(category)) return "category-unavailable";
  return null;
}

/** 지금 다섯 주사위의 눈. 주사위 순서(DieId) 그대로다. */
export function currentValues(state: GameState): DieValue[] {
  return state.dice.map((die) => die.value);
}

/** 기록. 현재 플레이어의 빈 카테고리에 다섯 눈으로 계산한 점수를 적는다. */
export function record(state: GameState, category: Category): CommandResult {
  const rejection = recordRejection(state, category);
  if (rejection) return { ok: false, reason: rejection };
  const points = scoreFor(category, currentValues(state));
  if (points === undefined) return { ok: false, reason: "category-unavailable" };
  const players = state.players.map((player, i) =>
    i === state.currentPlayer
      ? { ...player, scores: { ...player.scores, [category]: points } }
      : player,
  );
  return { ok: true, state: nextTurn({ ...state, players }) };
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
