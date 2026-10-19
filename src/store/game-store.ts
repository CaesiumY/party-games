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

  roll(): ActionResult;
  /** 홀드 토글. 3D 탭·홀드 말풍선·보이지 않는 주사위 버튼이 모두 이것을 쓴다. 열은 바꾸지 않는다. */
  toggleHold(die: DieId): ActionResult;
  select(category: Category): ActionResult;
  record(): ActionResult;
  /** 연출 입구가 알리는 멈춤. */
  presenterStopped(rollId: number): void;
  /** 연출 입구가 알리는 정렬 끝. 조작 잠금이 풀린다. */
  presenterLinedUp(rollId: number): void;
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
  /** 한 판의 처음 상태. 굴림 번호는 이어서 올려, 연출 입구가 지난 판의 굴림과 헷갈리지 않게 한다. */
  const fresh = (names: readonly string[]) => ({
    game: startGame(names),
    presentation: { phase: "idle" } as const,
    selection: null,
    columns: initialColumns(),
    outcome: null,
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
    rollId: 0,
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
      set({ game: result.state });
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
      const { presentation } = get();
      if (presentation.phase !== "idle" && presentation.rollId === rollId) {
        set({ presentation: { phase: "idle" } });
      }
    },

    setReducedMotion(on) {
      set({ reducedMotion: on });
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
