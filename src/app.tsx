import type { ComponentType } from "react";
import { Board3D } from "./scene/board-3d";
import { type Sound, silentSound } from "./sound/sound";
import { SoundProvider } from "./sound/sound-context";
import { type GameStore, resultVisible } from "./store/game-store";
import { GameStoreProvider, useGame } from "./store/store-context";
import { GameScreen } from "./ui/game-screen";
import { NoWebGL } from "./ui/no-webgl";
import { ResultScreen } from "./ui/result-screen";
import { StartScreen } from "./ui/start-screen";

export interface AppProps {
  store: GameStore;
  /** WebGL 을 쓸 수 있는지. 시작할 때 src/scene/webgl.ts 로 한 번 감지한다. */
  webgl: boolean;
  /** 효과음. 없으면 소리를 내지 않는다(테스트). */
  sound?: Sound;
  /** 3D 판 영역. 테스트에서만 바꾼다. */
  Board?: ComponentType;
}

export function App({ store, webgl, sound = silentSound, Board = Board3D }: AppProps) {
  if (!webgl) return <NoWebGL />;
  return (
    <GameStoreProvider store={store}>
      <SoundProvider sound={sound}>
        <Screens Board={Board} />
      </SoundProvider>
    </GameStoreProvider>
  );
}

/** 시작 화면 → 게임 화면 → (게임이 끝나면) 결과 화면. */
function Screens({ Board }: { Board: ComponentType }) {
  const screen = useGame((s) => s.screen);
  const showResult = useGame(resultVisible);
  if (screen === "start") return <StartScreen />;
  if (showResult) return <ResultScreen />;
  return <GameScreen Board={Board} />;
}
