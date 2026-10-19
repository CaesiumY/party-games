import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browserMotionQuery, syncReducedMotion } from "./a11y/reduced-motion";
import { App } from "./app";
import { createCryptoDiceSource } from "./engine/crypto-dice-source";
import { hasWebGL } from "./scene/webgl";
import { fetchClip, SOUND_CLIPS } from "./sound/clips";
import { createSound } from "./sound/sound";
import { bestScoreValue } from "./store/best-score";
import { createGameStore } from "./store/game-store";
import { mutedValue } from "./store/muted";
import { browserStorage } from "./store/stored-value";
import "./ui/app.css";

/**
 * 임시: 대전 모드의 시작 화면(#9)이 들어오기 전까지, `?players=1..4` 로 열면 시작 화면을 건너뛰고
 * 그 인원으로 바로 게임을 연다(화면 배치 확인용). 없으면 시작 화면부터 연다.
 */
function debugPlayers(): string[] | undefined {
  const requested = Number(new URLSearchParams(location.search).get("players"));
  if (!Number.isInteger(requested) || requested < 1 || requested > 4) return undefined;
  return Array.from({ length: requested }, (_, i) => `플레이어 ${i + 1}`);
}

const storage = browserStorage();
const store = createGameStore({
  players: debugPlayers(),
  diceSource: createCryptoDiceSource(),
  bestScore: bestScoreValue(storage),
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
