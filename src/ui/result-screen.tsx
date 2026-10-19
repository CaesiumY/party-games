import { useState } from "react";
import { gameMode } from "../engine/game";
import { ranking } from "../engine/ranking";
import { totalScore } from "../engine/totals";
import { useGame } from "../store/store-context";
import { Confetti } from "./confetti";
import { PlayerDot } from "./player-dot";

/**
 * 결과 화면. 모드(플레이어 수)로 가른다.
 * 연습 모드는 이번 총합 득점과 최고 점수, 새 최고 점수 여부를 보여 준다.
 * 대전 모드는 원작처럼 두 장이다(스펙 「결과 화면의 승자 표시」): 순위 표 → 「다음」 → 승자 화면.
 */
export function ResultScreen() {
  const versus = useGame((s) => gameMode(s.game) === "versus");
  return versus ? <VersusResult /> : <PracticeResult />;
}

/**
 * 연습 모드 결과. 최고 점수 비교(`outcome`)는 그 판을 끝낸 기록 때 정해진다. 그 비교가 없으면
 * (예: 끝난 판을 이어 하기로 연 경우) 최고 점수 줄 없이 총합 득점만 보여 준다.
 */
function PracticeResult() {
  const outcome = useGame((s) => s.outcome);
  const total = useGame((s) => (s.game.players[0] ? totalScore(s.game.players[0]) : 0));
  return (
    <main className="result" aria-labelledby="result-title">
      <h1 id="result-title">결과</h1>
      {outcome?.isNewBest && <p className="new-best">새 최고 점수!</p>}
      <p className="total">총합 득점 {outcome?.total ?? total}</p>
      {outcome && <p className="best">최고 점수 {outcome.best}</p>}
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
  // 색종이는 화면 전체에 겹쳐서(position: fixed) main 의 세로 배치에 끼지 않게 바깥에 둔다.
  return (
    <>
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
      </main>
      <Confetti />
    </>
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
