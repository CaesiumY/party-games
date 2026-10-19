import { totalScore } from "../engine/totals";
import { useGame } from "../store/store-context";

/**
 * 결과 화면. 연습 모드는 이번 총합 득점과 최고 점수, 새 최고 점수 여부를 보여 준다.
 * 대전 모드의 순위 표와 승자 화면은 #9 가 이 자리를 채운다. 그 전까지는 플레이어별 총합 득점만 적는다.
 */
export function ResultScreen() {
  const outcome = useGame((s) => s.outcome);
  const players = useGame((s) => s.game.players);
  const restart = useGame((s) => s.restart);
  const goHome = useGame((s) => s.goHome);
  return (
    <main className="result" aria-labelledby="result-title">
      <h1 id="result-title">결과</h1>
      {outcome ? (
        <>
          {outcome.isNewBest && <p className="new-best">새 최고 점수!</p>}
          <p className="total">총합 득점 {outcome.total}</p>
          <p className="best">최고 점수 {outcome.best}</p>
        </>
      ) : (
        <ul className="totals">
          {players.map((player) => (
            <li key={player.name}>
              {player.name} {totalScore(player)}
            </li>
          ))}
        </ul>
      )}
      <div className="result-actions">
        <button type="button" className="primary" onClick={() => restart()}>
          같은 멤버로 다시
        </button>
        <button type="button" onClick={() => goHome()}>
          처음으로
        </button>
      </div>
    </main>
  );
}
