import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useStore } from "zustand";
import type { GameStore, GameStoreState } from "./game-store";
import { judge, type Permissions, previewVisible } from "./permissions";

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
  return useMemo(() => judge({ game, presentation, selection }), [game, presentation, selection]);
}

/** 점수 미리보기를 보일지. */
export function usePreviewVisible(): boolean {
  const game = useGame((s) => s.game);
  const presentation = useGame((s) => s.presentation);
  return previewVisible({ game, presentation, selection: null });
}
