import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browserMotionQuery, syncReducedMotion } from "./a11y/reduced-motion";
import { App } from "./app";
import { createCryptoDiceSource } from "./engine/crypto-dice-source";
import { hasWebGL } from "./scene/webgl";
import { createGameStore } from "./store/game-store";
import "./ui/app.css";

/**
 * 시작 화면(#8)·대전 모드(#9)가 들어오기 전의 임시 시작: 바로 게임을 연다.
 * 화면 배치 확인용으로 `?players=1..4` 로 인원을 바꿀 수 있다(기본 1명).
 */
function bootPlayers(): string[] {
  const requested = Number(new URLSearchParams(location.search).get("players"));
  const count = Number.isInteger(requested) && requested >= 1 && requested <= 4 ? requested : 1;
  return Array.from({ length: count }, (_, i) => `플레이어 ${i + 1}`);
}

const store = createGameStore({ players: bootPlayers(), diceSource: createCryptoDiceSource() });
const motion = browserMotionQuery();
if (motion) syncReducedMotion(motion, store.getState().setReducedMotion);

const root = document.getElementById("root");
if (!root) throw new Error("#root 가 없다");
createRoot(root).render(
  <StrictMode>
    <App store={store} webgl={hasWebGL()} />
  </StrictMode>,
);
