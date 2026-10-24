import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browserMotionQuery, syncReducedMotion } from "./a11y/reduced-motion";
import { App } from "./app";
import { createCryptoDiceSource } from "./engine/crypto-dice-source";
import type { DiceSource } from "./engine/dice-source";
import { createE2EDiceSource, E2E_DICE_SOURCE_MARKER } from "./engine/e2e-dice-source";
import { hasWebGL } from "./scene/webgl";
import { fetchClip, SOUND_CLIPS } from "./sound/clips";
import { createSound } from "./sound/sound";
import { bestScoreValue } from "./store/best-score";
import { createGameStore } from "./store/game-store";
import { mutedValue } from "./store/muted";
import { savedGameValue } from "./store/saved-game";
import { browserStorage } from "./store/stored-value";
import "./ui/tokens.css";
import "./ui/app.css";

/** 운영은 암호학적 난수, 테스트용 빌드(`--mode e2e`)만 E2E 용 공급원. 운영 번들에는 E2E 쪽이 빠진다. */
function diceSource(): DiceSource {
  if (__E2E_DICE_SOURCE__) {
    window.__yachtDiceSource = E2E_DICE_SOURCE_MARKER;
    return createE2EDiceSource();
  }
  return createCryptoDiceSource();
}

const storage = browserStorage();
const store = createGameStore({
  diceSource: diceSource(),
  bestScore: bestScoreValue(storage),
  savedGame: savedGameValue(storage),
  muted: mutedValue(storage),
});
// 오디오는 첫 굴림 탭에서 만든다(자동 재생 제한). 여기서는 음원 파일만 받아 둔다.
const sound = createSound({
  clips: SOUND_CLIPS,
  load: fetchClip,
  createContext: () => new AudioContext(),
});
const motion = browserMotionQuery();
if (motion) syncReducedMotion(motion, store.getState().setReducedMotion);

const root = document.getElementById("root");
if (!root) throw new Error("#root 가 없다");
createRoot(root).render(
  <StrictMode>
    <App store={store} webgl={hasWebGL()} sound={sound} />
  </StrictMode>,
);
