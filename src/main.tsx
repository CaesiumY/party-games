import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browserMotionQuery, syncReducedMotion } from "./a11y/reduced-motion";
import { App } from "./app";
import { createCryptoDiceSource } from "./engine/crypto-dice-source";
import { hasWebGL } from "./scene/webgl";
import { bestScoreValue } from "./store/best-score";
import { createGameStore } from "./store/game-store";
import { browserStorage } from "./store/stored-value";
import "./ui/app.css";

const store = createGameStore({
  diceSource: createCryptoDiceSource(),
  bestScore: bestScoreValue(browserStorage()),
});
const motion = browserMotionQuery();
if (motion) syncReducedMotion(motion, store.getState().setReducedMotion);

const root = document.getElementById("root");
if (!root) throw new Error("#root 가 없다");
createRoot(root).render(
  <StrictMode>
    <App store={store} webgl={hasWebGL()} />
  </StrictMode>,
);
