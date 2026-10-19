import { createStore } from "zustand/vanilla";
import type { DiceSource } from "../engine/dice-source";
import { comboCallout, record, roll, rollsLeft, startGame, toggleHold } from "../engine/game";
import { bonusNotice } from "../engine/totals";
import type { Category, DieId, GameState } from "../engine/types";
import { type DieSlot, diceSlots, initialColumns, lineupColumns } from "../layout/columns";
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
} from "./permissions";

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
  /**
   * 떠 있는 성립 알림. 굴림의 정렬 끝에 정해지고, 알림 표시가 끝나면(`calloutEnded`)·다시 굴리거나 기록하면 지워진다.
   * 조작을 막지 않는다. 저장하지 않는다.
   */
  callout: Callout | null;
  /**
   * 떠 있는 보너스 알림. 있는 동안 화면의 차례 넘김을 미룬다(`shownPlayer`). 저장하지 않는다.
   * 차례 배너(#9)와 결과 화면은 이것이 지워진 뒤에 띄운다(src/README.md 「차례 넘김 미루기」).
   */
  bonusNotice: HandOffNotice | null;

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
  /** 성립 알림 표시가 끝남. 그 굴림의 알림일 때만 지운다. */
  calloutEnded(rollId: number): void;
  /** 보너스 알림 표시가 끝남(약 2초). 그 알림일 때만 지운다. 이때 화면의 차례가 다음 플레이어로 넘어간다. */
  bonusNoticeEnded(id: number): void;

  permissions(): Permissions;
  /** 화면이 지금 차례로 보여 줄 플레이어. 보너스 알림 동안은 방금 기록한 플레이어다. */
  shownPlayer(): number;
  previewVisible(): boolean;
  /** 주사위마다 놓이는 자리(DieId 순서). 3번째 굴림의 정렬이 끝나면 다섯 개 모두 홀드 자리다. */
  slots(): DieSlot[];
}

/** 성립 알림: 어느 굴림에서 어느 카테고리가 성립했는지. */
export interface Callout {
  rollId: number;
  category: Category;
}

export interface GameStoreOptions {
  players: readonly string[];
  diceSource: DiceSource;
  reducedMotion?: boolean;
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore({ players, diceSource, reducedMotion = false }: GameStoreOptions) {
  return createStore<GameStoreState>()((set, get) => ({
    game: startGame(players),
    presentation: { phase: "idle" },
    rollId: 0,
    selection: null,
    columns: initialColumns(),
    reducedMotion,
    callout: null,
    bonusNotice: null,

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
      // 엔진은 기록과 함께 다음 차례로 넘어갔다. 보너스 알림이 있으면 화면의 차례 넘김은 알림 끝까지 미룬다.
      const player = state.game.currentPlayer;
      const before = state.game.players[player];
      const after = result.state.players[player];
      const notice = before && after ? bonusNotice(before, after) : null;
      set({
        game: result.state,
        selection: null,
        callout: null,
        // 한 기록에는 굴림이 적어도 한 번 있으므로 지금 굴림 번호가 알림마다 다르다.
        bonusNotice: notice ? { id: state.rollId, player, notice } : null,
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
        const category = comboCallout(get().game);
        set({
          presentation: { phase: "idle" },
          callout: category ? { rollId, category } : null,
        });
      }
    },

    setReducedMotion(on) {
      set({ reducedMotion: on });
    },

    calloutEnded(rollId) {
      if (get().callout?.rollId === rollId) set({ callout: null });
    },

    bonusNoticeEnded(id) {
      if (get().bonusNotice?.id === id) set({ bonusNotice: null });
    },

    permissions: () => judge(get()),
    shownPlayer: () => shownPlayer(get()),
    previewVisible: () => previewVisible(get()),
    slots: () => diceSlots(get().game.dice, get().columns, { allUp: allDiceUp(get()) }),
  }));
}
