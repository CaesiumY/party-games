import { createStore } from "zustand/vanilla";
import type { DiceSource } from "../engine/dice-source";
import { gameMode, record, roll, rollsLeft, startGame, toggleHold } from "../engine/game";
import { totalScore } from "../engine/totals";
import type { Category, DieId, GameState } from "../engine/types";
import { type DieSlot, diceSlots, initialColumns, lineupColumns } from "../layout/columns";
import { type PracticeOutcome, settleBest } from "./best-score";
import {
  type ActionResult,
  allDiceUp,
  holdBlocker,
  judge,
  type Permissions,
  type Presentation,
  previewVisible,
  recordBlocker,
  rollBlocker,
  selectBlocker,
} from "./permissions";
import type { StoredValue } from "./stored-value";

/** 지금 보이는 화면. 결과 화면은 게임 화면에서 게임이 끝나면 뜬다(`resultVisible`). */
export type Screen = "start" | "game";

/** 인원을 고르기 전(시작 화면)에 쥐고 있는 자리 채움 게임. 화면에 보이지 않는다. */
const PLACEHOLDER_PLAYERS = ["플레이어 1"];

export interface GameStoreState {
  /** 게임 엔진의 상태. 저장·복원 대상은 이것뿐이다. */
  game: GameState;
  /** 굴림 연출 진행 상태. 저장하지 않는다. */
  presentation: Presentation;
  /** 굴림마다 1씩 오르는 번호. 연출 입구는 이 번호로 지금 굴림을 알아본다. */
  rollId: number;
  /** 기록 전에 골라 둔 카테고리. 화면 상태다. */
  selection: Category | null;
  /** 주사위 DieId 별 열(0 = 왼쪽). 화면이 정하는 표현이다. */
  columns: number[];
  /** 기기의 '동작 줄이기' 설정. 켜져 있으면 순간 배치 연출만 쓴다. */
  reducedMotion: boolean;
  screen: Screen;
  /** 이 기기의 최고 점수. 아직 없으면 null. */
  best: number | null;
  /** 끝난 연습 모드 판의 결과. 게임 도중이나 대전 모드는 null. */
  outcome: PracticeOutcome | null;
  /** 홀드·홀드 풀기로 자리를 옮겨 가는 중인 주사위. 저장하지 않는다. */
  movingDice: readonly DieId[];

  roll(): ActionResult;
  /** 홀드 토글. 3D 탭·홀드 말풍선·보이지 않는 주사위 버튼이 모두 이것을 쓴다. 열은 바꾸지 않는다. */
  toggleHold(die: DieId): ActionResult;
  select(category: Category): ActionResult;
  record(): ActionResult;
  /** 연출 입구가 알리는 멈춤. */
  presenterStopped(rollId: number): void;
  /** 연출 입구가 알리는 정렬 끝. 조작 잠금이 풀린다. */
  presenterLinedUp(rollId: number): void;
  /** 연출 입구가 알리는, 주사위 하나가 굴림이 아닌 자리 바뀜(홀드·홀드 풀기 등)을 다 옮겼음. */
  presenterDieSettled(die: DieId): void;
  setReducedMotion(on: boolean): void;
  /** 이 플레이어들로 첫 턴부터 새 게임을 열고 게임 화면으로 간다. */
  newGame(players: readonly string[]): void;
  /** 「같은 멤버로 다시」: 같은 플레이어로 새 게임. */
  restart(): void;
  /** 「처음으로」: 시작 화면을 연다. */
  goHome(): void;

  permissions(): Permissions;
  previewVisible(): boolean;
  /** 주사위마다 놓이는 자리(DieId 순서). 3번째 굴림의 정렬이 끝나면 다섯 개 모두 홀드 자리다. */
  slots(): DieSlot[];
  /** 결과 화면을 띄울지. */
  resultVisible(): boolean;
}

export interface GameStoreOptions {
  /** 주면 이 플레이어들로 게임 화면부터 연다. 없으면 시작 화면부터 연다. */
  players?: readonly string[];
  diceSource: DiceSource;
  reducedMotion?: boolean;
  /** 이 기기의 최고 점수 저장 항목. 없으면 최고 점수를 읽지도 쓰지도 않는다. */
  bestScore?: StoredValue<number>;
}

/** 결과 화면을 띄울지: 게임 화면에서 게임이 끝났을 때. */
export function resultVisible(s: { screen: Screen; game: GameState }): boolean {
  return s.screen === "game" && s.game.finished;
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore({
  players,
  diceSource,
  reducedMotion = false,
  bestScore,
}: GameStoreOptions) {
  /**
   * 한 판의 처음 상태. 굴림 번호도 0으로 돌린다. 연출 입구는 0을 "아직 굴리지 않음"으로 읽으므로,
   * 새 판을 연 판 영역이 지난 판의 마지막 굴림을 다시 연출하지 않는다.
   */
  const fresh = (names: readonly string[]) => ({
    game: startGame(names),
    presentation: { phase: "idle" } as const,
    rollId: 0,
    selection: null,
    columns: initialColumns(),
    outcome: null,
    movingDice: [] as readonly DieId[],
  });

  /** 연습 모드 판이 끝났으면 최고 점수와 견주고, 넘었으면 저장한다. */
  const settle = (game: GameState, previous: number | null): PracticeOutcome | null => {
    const player = game.players[0];
    if (!game.finished || gameMode(game) !== "practice" || !player) return null;
    const outcome = settleBest(previous, totalScore(player));
    if (outcome.isNewBest) bestScore?.write(outcome.best);
    return outcome;
  };

  return createStore<GameStoreState>()((set, get) => ({
    ...fresh(players ?? PLACEHOLDER_PLAYERS),
    reducedMotion,
    screen: players ? "game" : "start",
    best: bestScore?.read() ?? null,

    roll() {
      const blocker = rollBlocker(get());
      if (blocker) return { ok: false, reason: blocker };
      const result = roll(get().game, diceSource);
      if (!result.ok) return result;
      const rollId = get().rollId + 1;
      set({
        game: result.state,
        rollId,
        presentation: { phase: "rolling", rollId },
        selection: null,
        columns: lineupColumns(result.state.dice, { finalRoll: rollsLeft(result.state) === 0 }),
      });
      return { ok: true };
    },

    toggleHold(die) {
      const blocker = holdBlocker(get(), die);
      if (blocker) return { ok: false, reason: blocker };
      const result = toggleHold(get().game, die);
      if (!result.ok) return result;
      // '동작 줄이기'면 순간 이동이라 옮겨 가는 동안이 없다.
      const { movingDice, reducedMotion } = get();
      set({ game: result.state, movingDice: reducedMotion ? movingDice : [...movingDice, die] });
      return { ok: true };
    },

    select(category) {
      const blocker = selectBlocker(get(), category);
      if (blocker) return { ok: false, reason: blocker };
      set({ selection: category });
      return { ok: true };
    },

    record() {
      const state = get();
      const blocker = recordBlocker(state);
      if (blocker || state.selection === null) {
        return { ok: false, reason: blocker ?? "no-selection" };
      }
      const result = record(state.game, state.selection);
      if (!result.ok) return result;
      const outcome = settle(result.state, state.best);
      set({
        game: result.state,
        selection: null,
        outcome,
        ...(outcome ? { best: outcome.best } : {}),
      });
      return { ok: true };
    },

    presenterStopped(rollId) {
      const { presentation } = get();
      if (presentation.phase === "rolling" && presentation.rollId === rollId) {
        set({ presentation: { phase: "stopped", rollId } });
      }
    },

    presenterLinedUp(rollId) {
      const { presentation, game, reducedMotion } = get();
      if (presentation.phase !== "rolling" && presentation.phase !== "stopped") return;
      if (presentation.rollId !== rollId) return;
      // 3번째 굴림이면 정렬 줄의 주사위가 이어서 홀드 자리로 올라간다. 다 옮길 때까지 모두 막는다.
      const rising = game.dice.filter((d) => !d.held).map((d) => d.id);
      if (rollsLeft(game) === 0 && rising.length > 0 && !reducedMotion) {
        set({ presentation: { phase: "auto-moving", rollId }, movingDice: rising });
        return;
      }
      set({ presentation: { phase: "idle" } });
    },

    presenterDieSettled(die) {
      const { movingDice, presentation } = get();
      if (!movingDice.includes(die)) return;
      const rest = movingDice.filter((d) => d !== die);
      const done = presentation.phase === "auto-moving" && rest.length === 0;
      set(done ? { movingDice: rest, presentation: { phase: "idle" } } : { movingDice: rest });
    },

    setReducedMotion(on) {
      if (!on) {
        set({ reducedMotion: on });
        return;
      }
      // 순간 배치 연출로 바뀌어 옮겨 가던 주사위가 곧바로 제자리에 놓인다.
      const { presentation } = get();
      set({
        reducedMotion: on,
        movingDice: [],
        presentation: presentation.phase === "auto-moving" ? { phase: "idle" } : presentation,
      });
    },

    newGame(names) {
      set({ ...fresh(names), screen: "game" });
    },

    restart() {
      get().newGame(get().game.players.map((player) => player.name));
    },

    goHome() {
      set({ screen: "start" });
    },

    permissions: () => judge(get()),
    previewVisible: () => previewVisible(get()),
    slots: () => diceSlots(get().game.dice, get().columns, { allUp: allDiceUp(get()) }),
    resultVisible: () => resultVisible(get()),
  }));
}
