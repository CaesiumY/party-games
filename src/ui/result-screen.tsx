import { useState } from "react";
import { gameMode } from "../engine/game";
import { ranking } from "../engine/ranking";
import type { PracticeOutcome } from "../store/best-score";
import { useGame } from "../store/store-context";
import { Confetti } from "./confetti";
import { PlayerDot } from "./player-dot";

/**
 * 결과 화면. 연습 모드는 이번 총합 득점과 최고 점수, 새 최고 점수 여부를 보여 준다.
 * 대전 모드는 원작처럼 두 장이다(스펙 「결과 화면의 승자 표시」): 순위 표 → 「다음」 → 승자 화면.
 */
export function ResultScreen() {
  const outcome = useGame((s) => s.outcome);
  const versus = useGame((s) => gameMode(s.game) === "versus");
  if (versus || !outcome) return <VersusResult />;
  return <PracticeResult outcome={outcome} />;
}

function PracticeResult({ outcome }: { outcome: PracticeOutcome }) {
  return (
    <main className="result" aria-labelledby="result-title">
      <h1 id="result-title">결과</h1>
      {outcome.isNewBest && <p className="new-best">새 최고 점수!</p>}
      <p className="total">총합 득점 {outcome.total}</p>
      <p className="best">최고 점수 {outcome.best}</p>
      <ResultActions />
    </main>
  );
}

/** 대전 모드 결과. 화면에 붙을 때마다 순위 표부터 보여 준다. */
function VersusResult() {
  const [page, setPage] = useState<"ranks" | "winner">("ranks");
  return page === "ranks" ? <RankTable onNext={() => setPage("winner")} /> : <Winners />;
}

/** 순위 표: 총합 득점 순서, 동점이면 같은 순위. */
function RankTable({ onNext }: { onNext(): void }) {
  const game = useGame((s) => s.game);
  return (
    <main className="result" aria-labelledby="result-title">
      <h1 id="result-title">결과</h1>
      <table className="ranks">
        <caption className="visually-hidden">순위</caption>
        <thead>
          <tr>
            <th scope="col">순위</th>
            <th scope="col">이름</th>
            <th scope="col">총합 득점</th>
          </tr>
        </thead>
        <tbody>
          {ranking(game).map((standing) => (
            <tr key={standing.player} className={standing.rank === 1 ? "first" : undefined}>
              <td>{standing.rank}위</td>
              <td className="name">
                <PlayerDot player={standing.player} />
                {game.players[standing.player]?.name}
              </td>
              <td>{standing.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="result-actions">
        <button type="button" className="primary" onClick={onNext}>
          다음
        </button>
      </div>
    </main>
  );
}

/** 승자 화면: 1등(동점이면 공동 1등 모두)의 색·이름·총합 득점을 크게 띄우고 색종이를 날린다. */
function Winners() {
  const game = useGame((s) => s.game);
  const winners = ranking(game).filter((standing) => standing.rank === 1);
  return (
    <main className="result winner" aria-labelledby="winner-title">
      {/* 원작 그대로의 문구(조사 보고서 4.8). 순위 표의 제목은 「결과」다. */}
      <h1 id="winner-title">Winner!</h1>
      <ul className="winners">
        {winners.map((standing) => (
          <li key={standing.player}>
            <PlayerDot player={standing.player} size="large" />
            <span className="winner-name">{game.players[standing.player]?.name}</span>
            <span className="winner-total">총합 득점 {standing.total}</span>
          </li>
        ))}
      </ul>
      <ResultActions />
      <Confetti />
    </main>
  );
}

function ResultActions() {
  const restart = useGame((s) => s.restart);
  const goHome = useGame((s) => s.goHome);
  return (
    <div className="result-actions">
      <button type="button" className="primary" onClick={() => restart()}>
        같은 멤버로 다시
      </button>
      <button type="button" onClick={() => goHome()}>
        처음으로
      </button>
    </div>
  );
}
