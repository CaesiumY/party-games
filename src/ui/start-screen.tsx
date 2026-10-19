import { useGame } from "../store/store-context";
import { HowToPlayButton } from "./how-to-play";

/** 혼자 시작할 때의 기본 이름(스펙 「게임 시작」: 이름을 비워 두면 "플레이어 1"). */
const SOLO = ["플레이어 1"];

/**
 * 시작 화면(최소판). 혼자 시작하는 버튼, "플레이 방법" 버튼, 이 기기의 최고 점수가 있다.
 * 인원·이름·색 입력은 대전 모드(#9)가 이 화면에 덧붙인다.
 */
export function StartScreen() {
  const best = useGame((s) => s.best);
  const newGame = useGame((s) => s.newGame);
  return (
    <main className="start" aria-labelledby="start-title">
      <h1 id="start-title">요트</h1>
      <p className="best">최고 점수 {best ?? "없음"}</p>
      <button type="button" className="primary" onClick={() => newGame(SOLO)}>
        혼자 시작
      </button>
      <HowToPlayButton>플레이 방법</HowToPlayButton>
    </main>
  );
}
