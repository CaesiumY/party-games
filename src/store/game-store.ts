import { createStore } from "zustand/vanilla";
import type { DiceSource } from "../engine/dice-source";
import {
  comboCallout,
  gameMode,
  record,
  roll,
  rollsLeft,
  startGame,
  toggleHold,
} from "../engine/game";
import { bonusNotice, totalScore } from "../engine/totals";
import type { Category, DieId, GameState } from "../engine/types";
import { type DieSlot, diceSlots, initialColumns, lineupColumns } from "../layout/columns";
import { type PracticeOutcome, settleBest } from "./best-score";
import {
  type ActionResult,
  allDiceUp,
  type HandOffNotice,
  holdBlocker,
  judge,
  type Permissions,
  type Presentation,
  previewVisible,
  recordBlocker,
  rollBlocker,
  selectBlocker,
  shownPlayer,
  shownRollsLeft,
  shownTurn,
  type TurnBanner,
} from "./permissions";
import type { SavedGame } from "./saved-game";
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
  /**
   * 떠 있는 성립 알림. 굴림의 정렬 끝에 정해지고, 알림 표시가 끝나면(`calloutEnded`)·다시 굴리거나 기록하면 지워진다.
   * 조작을 막지 않는다. 저장하지 않는다.
   */
  callout: Callout | null;
  /**
   * 떠 있는 보너스 알림. 있는 동안 화면의 차례 넘김을 미룬다(`shownPlayer`). 저장하지 않는다.
   * 결과 화면은 이것이 지워진 뒤에 띄우고(src/README.md 「차례 넘김 미루기」), 차례 배너도 그때 띄운다(「차례 배너」).
   */
  bonusNotice: HandOffNotice | null;
  /**
   * 떠 있는 차례 배너("다음은 ○○ 차례"). 대전 모드에서 화면의 차례가 다음 플레이어로 넘어갈 때(기록 뒤, 보너스 알림이
   * 있으면 그 알림이 끝난 뒤) 뜬다. 조작은 막지 않고 "?" 만 막는다. 저장하지 않는다.
   */
  turnBanner: TurnBanner | null;
  /**
   * 시작 화면에서 이어 할 수 있는 게임. 앱을 열 때 저장된 진행 중 게임을 읽은 것이고,
   * 이어 하거나(`resume`) 새 게임을 시작하면 지워진다. 이어 할 게임이 없으면 null.
   */
  resumable: SavedGame | null;

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
  /** 「이어 하기」: 저장된 게임을 그 상태 그대로 게임 화면에 연다. 굴림 연출은 다시 틀지 않는다. */
  resume(): void;
  /** 성립 알림 표시가 끝남. 그 굴림의 알림일 때만 지운다. */
  calloutEnded(rollId: number): void;
  /** 보너스 알림 표시가 끝남(약 2초). 그 알림일 때만 지운다. 이때 화면의 차례가 다음 플레이어로 넘어간다. */
  bonusNoticeEnded(id: number): void;
  /** 차례 배너 표시가 끝남. 그 배너일 때만 지운다. */
  turnBannerEnded(id: number): void;

  permissions(): Permissions;
  /** 화면이 지금 차례로 보여 줄 플레이어. 보너스 알림 동안은 방금 기록한 플레이어다. */
  shownPlayer(): number;
  /** 화면이 보여 줄 턴 번호. 보너스 알림 동안은 방금 기록한 플레이어가 기록한 턴이다. */
  shownTurn(): number;
  /** 화면이 보여 줄 남은 굴림 횟수. 보너스 알림 동안은 방금 기록한 플레이어가 기록할 때의 값이다. */
  shownRollsLeft(): number;
  previewVisible(): boolean;
  /** 주사위마다 놓이는 자리(DieId 순서). 3번째 굴림의 정렬이 끝나면 다섯 개 모두 홀드 자리다. */
  slots(): DieSlot[];
  /** 결과 화면을 띄울지. */
  resultVisible(): boolean;
}

/** 성립 알림: 어느 굴림에서 어느 카테고리가 성립했는지. */
export interface Callout {
  rollId: number;
  category: Category;
}

export interface GameStoreOptions {
  /** 주면 이 플레이어들로 게임 화면부터 연다. 없으면 시작 화면부터 연다. */
  players?: readonly string[];
  diceSource: DiceSource;
  reducedMotion?: boolean;
  /** 이 기기의 최고 점수 저장 항목. 없으면 최고 점수를 읽지도 쓰지도 않는다. */
  bestScore?: StoredValue<number>;
  /**
   * 진행 중 게임 저장 항목. 게임 상태나 주사위의 열이 바뀔 때마다 쓰고, 게임이 끝나면 지운다.
   * `players` 없이 열 때 읽어서, 있으면 시작 화면에서 이어 할 수 있다. 없으면 읽지도 쓰지도 않는다.
   */
  savedGame?: StoredValue<SavedGame>;
}

/**
 * 결과 화면을 띄울지: 게임 화면에서 게임이 끝났을 때. 마지막 기록이 보너스 알림을 띄웠으면
 * 알림이 끝난 뒤에 띄운다(스펙 「보너스 알림」).
 */
export function resultVisible(s: {
  screen: Screen;
  game: GameState;
  bonusNotice: HandOffNotice | null;
}): boolean {
  return s.screen === "game" && s.game.finished && s.bonusNotice === null;
}

/**
 * 판을 열 때(새 게임·이어 하기)의 화면 상태. 연출이 끝났고 선택·결과·옮겨 가는 주사위·알림·배너가 없다.
 * 굴림 번호는 0이다. 연출 입구는 0을 "아직 굴리지 않음"으로 읽어, 다시 굴리지 않고 열 그대로 자리에 놓는다.
 * 그래서 지난 판의 마지막 굴림이나 알림이 새로 연 판에 남지 않는다.
 */
function openedBoard(game: GameState, columns: number[]) {
  return {
    game,
    columns,
    presentation: { phase: "idle" } as const,
    rollId: 0,
    selection: null,
    outcome: null,
    movingDice: [] as readonly DieId[],
    callout: null,
    bonusNotice: null,
    turnBanner: null,
  };
}

/** 저장된 게임을 다시 열 때의 상태. 연출 진행 상태는 저장하지 않았으므로 연출이 끝난 상태로 연다. */
function restored({ game, columns }: SavedGame) {
  return openedBoard(game, columns);
}

/**
 * 화면의 차례가 `from` 에서 넘어갈 때 띄울 차례 배너. 게임이 끝났거나 차례가 그대로면(연습 모드) 없다.
 * 엔진은 게임이 끝나면 지금 차례를 마지막 플레이어에 둔다.
 */
function bannerAfter(game: GameState, from: number, id: number): TurnBanner | null {
  if (game.finished || game.currentPlayer === from) return null;
  return { id, player: game.currentPlayer };
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore({
  players,
  diceSource,
  reducedMotion = false,
  bestScore,
  savedGame,
}: GameStoreOptions) {
  /** 한 판의 처음 상태. */
  const fresh = (names: readonly string[]) => openedBoard(startGame(names), initialColumns());

  /** 연습 모드 판이 끝났으면 최고 점수와 견주고, 넘었으면 저장한다. */
  const settle = (game: GameState, previous: number | null): PracticeOutcome | null => {
    const player = game.players[0];
    if (!game.finished || gameMode(game) !== "practice" || !player) return null;
    const outcome = settleBest(previous, totalScore(player));
    if (outcome.isNewBest) bestScore?.write(outcome.best);
    return outcome;
  };

  const resumable = players ? null : (savedGame?.read() ?? null);

  const store = createStore<GameStoreState>()((set, get) => ({
    ...fresh(players ?? PLACEHOLDER_PLAYERS),
    // 이어 할 게임을 쥐고 있으면 시작 화면의 이름 칸도 그 게임의 이름으로 채워진다.
    ...(resumable ? restored(resumable) : {}),
    reducedMotion,
    screen: players ? "game" : "start",
    best: bestScore?.read() ?? null,
    resumable,

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
        callout: null,
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
      // 엔진은 기록과 함께 다음 차례로 넘어갔다. 보너스 알림이 있으면 화면의 차례 넘김은 알림 끝까지 미룬다.
      const player = state.game.currentPlayer;
      const before = state.game.players[player];
      const after = result.state.players[player];
      const notice = before && after ? bonusNotice(before, after) : null;
      set({
        game: result.state,
        selection: null,
        outcome,
        ...(outcome ? { best: outcome.best } : {}),
        callout: null,
        // 한 기록에는 굴림이 적어도 한 번 있으므로 지금 굴림 번호가 알림마다 다르다.
        bonusNotice: notice
          ? {
              id: state.rollId,
              player,
              turn: state.game.turn,
              rollsLeft: rollsLeft(state.game),
              notice,
            }
          : null,
        // 보너스 알림이 있으면 배너는 알림이 끝날 때 띄운다.
        turnBanner: notice ? null : bannerAfter(result.state, player, state.rollId),
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
      // 성립 알림은 정렬 끝에 뜬다. 3번째 굴림의 자동 이동 중에도 그대로 떠 있다.
      const category = comboCallout(game);
      const callout = category ? { rollId, category } : null;
      // 3번째 굴림이면 정렬 줄의 주사위가 이어서 홀드 자리로 올라간다. 다 옮길 때까지 모두 막는다.
      const rising = game.dice.filter((d) => !d.held).map((d) => d.id);
      if (rollsLeft(game) === 0 && rising.length > 0 && !reducedMotion) {
        set({ presentation: { phase: "auto-moving", rollId }, movingDice: rising, callout });
        return;
      }
      set({ presentation: { phase: "idle" }, callout });
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
      set({ ...fresh(names), screen: "game", resumable: null });
    },

    restart() {
      get().newGame(get().game.players.map((player) => player.name));
    },

    goHome() {
      set({ screen: "start", turnBanner: null });
    },

    resume() {
      const { resumable } = get();
      if (!resumable) return;
      set({ ...restored(resumable), screen: "game", resumable: null });
    },

    calloutEnded(rollId) {
      if (get().callout?.rollId === rollId) set({ callout: null });
    },

    bonusNoticeEnded(id) {
      const { bonusNotice, game } = get();
      if (bonusNotice?.id !== id) return;
      // 이 순간이 화면의 차례 넘김이다.
      set({ bonusNotice: null, turnBanner: bannerAfter(game, bonusNotice.player, id) });
    },

    turnBannerEnded(id) {
      if (get().turnBanner?.id === id) set({ turnBanner: null });
    },

    permissions: () => judge(get()),
    shownPlayer: () => shownPlayer(get()),
    shownTurn: () => shownTurn(get()),
    shownRollsLeft: () => shownRollsLeft(get()),
    previewVisible: () => previewVisible(get()),
    slots: () => diceSlots(get().game.dice, get().columns, { allUp: allDiceUp(get()) }),
    resultVisible: () => resultVisible(get()),
  }));

  // 게임 상태나 주사위의 열이 바뀔 때마다 저장한다. 굴림 결과도 굴림 명령 때 곧바로 저장되어,
  // 연출 도중 새로고침해도 같다. 끝난 게임은 이어 할 수 없으므로 지운다.
  if (savedGame) {
    store.subscribe(({ game, columns }, previous) => {
      if (game === previous.game && columns === previous.columns) return;
      if (game.finished) savedGame.clear();
      else savedGame.write({ game, columns });
    });
  }
  return store;
}
