import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { contributingDice } from "../engine/game";
import type { DieId } from "../engine/types";
import { type DieSlot, diceSlots } from "../layout/columns";
import type { GameStore, GameStoreState } from "./game-store";
import { allDiceUp, judge, type Permissions, previewVisible, shownPlayer } from "./permissions";

const StoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** 화면과 3D 장면은 이 훅으로만 저장소를 읽고 명령을 보낸다. */
export function useGame<T>(selector: (state: GameStoreState) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error("GameStoreProvider 안에서만 쓸 수 있다");
  return useStore(store, selector);
}

/** 지금 조작할 수 있는 것들. 판정에 쓰이는 상태가 바뀔 때마다 다시 그린다. */
export function usePermissions(): Permissions {
  const game = useGame((s) => s.game);
  const presentation = useGame((s) => s.presentation);
  const selection = useGame((s) => s.selection);
  const movingDice = useGame((s) => s.movingDice);
  const bonusNotice = useGame((s) => s.bonusNotice);
  const turnBanner = useGame((s) => s.turnBanner);
  return useMemo(
    () => judge({ game, presentation, selection, movingDice, bonusNotice, turnBanner }),
    [game, presentation, selection, movingDice, bonusNotice, turnBanner],
  );
}

/**
 * 화면이 지금 차례로 보여 줄 플레이어. 보너스 알림 동안은 방금 기록한 플레이어이고, 알림이 끝나면 엔진의 지금 차례다.
 * 점수표의 차례 강조·지금 차례 표시가 이것을 쓴다. 차례 배너는 이 값이 바뀌는 순간에 뜬다.
 */
export function useShownPlayer(): number {
  return useGame((s) => shownPlayer(s));
}

/** 선택한 카테고리의 기여 주사위(DieId). 선택이 없으면 빈 배열이다. 점수 계산과 같은 곳에서 나온다. */
export function useContributingDice(): readonly DieId[] {
  const game = useGame((s) => s.game);
  const selection = useGame((s) => s.selection);
  return useMemo(
    () => (selection === null ? [] : contributingDice(game, selection)),
    [game, selection],
  );
}

/** 주사위마다 놓이는 자리(DieId 순서). 3번째 굴림의 정렬이 끝나면 다섯 개 모두 홀드 자리다. */
export function useDiceSlots(): DieSlot[] {
  const game = useGame((s) => s.game);
  const presentation = useGame((s) => s.presentation);
  const columns = useGame((s) => s.columns);
  return useMemo(
    () => diceSlots(game.dice, columns, { allUp: allDiceUp({ game, presentation }) }),
    [game, presentation, columns],
  );
}

/** 3번째 굴림의 정렬이 끝나 다섯 개가 모두 홀드 자리로 올라간 상태인지. */
export function useAllDiceUp(): boolean {
  const game = useGame((s) => s.game);
  const presentation = useGame((s) => s.presentation);
  return allDiceUp({ game, presentation });
}

/** 점수 미리보기를 보일지. */
export function usePreviewVisible(): boolean {
  const game = useGame((s) => s.game);
  const presentation = useGame((s) => s.presentation);
  return previewVisible({ game, presentation });
}
