import type { ComponentType } from "react";
import { Board3D } from "./scene/board-3d";
import type { GameStore } from "./store/game-store";
import { GameStoreProvider } from "./store/store-context";
import { GameScreen } from "./ui/game-screen";
import { NoWebGL } from "./ui/no-webgl";

export interface AppProps {
  store: GameStore;
  /** WebGL 을 쓸 수 있는지. 시작할 때 src/scene/webgl.ts 로 한 번 감지한다. */
  webgl: boolean;
  /** 3D 판 영역. 테스트에서만 바꾼다. */
  Board?: ComponentType;
}

export function App({ store, webgl, Board = Board3D }: AppProps) {
  if (!webgl) return <NoWebGL />;
  return (
    <GameStoreProvider store={store}>
      <GameScreen Board={Board} />
    </GameStoreProvider>
  );
}
