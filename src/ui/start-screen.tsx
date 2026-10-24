import { useState } from "react";
import { useGame } from "../store/store-context";
import { HowToPlayButton } from "./how-to-play";
import { PlayerDot } from "./player-dot";
import { defaultName, NAME_MAX_LENGTH, PLAYER_COUNTS, playerNames } from "./player-names";

/**
 * 시작 화면. 이어 할 게임이 있으면 먼저 "이어 하기"와 "새 게임"을 고른다(스펙 「이어 하기」).
 * 새 게임은 인원(1~4명)을 고르고 이름을 넣어 시작한다. 1명이면 연습 모드, 2~4명이면 대전 모드다.
 * 아래에 "플레이 방법" 버튼이 있다.
 */
export function StartScreen() {
  const best = useGame((s) => s.best);
  const resumable = useGame((s) => s.resumable !== null);
  const resume = useGame((s) => s.resume);
  // "새 게임"을 눌러도 저장된 게임은 새 게임을 시작할 때까지 남는다.
  const [choosingNew, setChoosingNew] = useState(false);

  return (
    <main className="start" aria-labelledby="start-title">
      <h1 id="start-title">요트</h1>
      {resumable && !choosingNew ? (
        <div className="resume">
          <p className="best">최고 점수 {best ?? "없음"}</p>
          <button type="button" className="primary" onClick={() => resume()}>
            이어 하기
          </button>
          <button type="button" onClick={() => setChoosingNew(true)}>
            새 게임
          </button>
        </div>
      ) : (
        <SetupForm best={best} />
      )}
      <HowToPlayButton>플레이 방법</HowToPlayButton>
    </main>
  );
}

/**
 * 새 게임 폼. 플레이어 색은 자리 순서로 정해진다. 처음으로 돌아오거나 이어 할 게임이 있으면
 * 그 게임의 인원과 이름이 채워져 있다.
 */
function SetupForm({ best }: { best: number | null }) {
  const newGame = useGame((s) => s.newGame);
  const last = useGame((s) => s.game.players);
  const [count, setCount] = useState(last.length);
  // 네 칸을 다 들고 있어서, 인원을 줄였다 늘려도 넣은 이름이 남는다. 기본 이름은 빈칸으로 보인다.
  const [inputs, setInputs] = useState(() =>
    PLAYER_COUNTS.map((_, i) => {
      const name = last[i]?.name ?? "";
      return name === defaultName(i) ? "" : name;
    }),
  );

  const setInput = (i: number, value: string) =>
    setInputs((prev) => prev.map((v, j) => (j === i ? value : v)));

  return (
    <form
      className="setup"
      onSubmit={(event) => {
        event.preventDefault();
        newGame(playerNames(inputs.slice(0, count)));
      }}
    >
      <div className="setup-card">
        <fieldset className="count">
          <legend>인원</legend>
          {PLAYER_COUNTS.map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="count"
                value={n}
                checked={count === n}
                onChange={() => setCount(n)}
              />
              <span>{n}명</span>
            </label>
          ))}
        </fieldset>
        <ol className="names">
          {inputs.slice(0, count).map((value, i) => (
            // 자리 순서가 곧 플레이어이고 칸 수만 바뀐다.
            // biome-ignore lint/suspicious/noArrayIndexKey: 이름 칸은 자리(순번)로 구분한다.
            <li key={i}>
              <PlayerDot player={i} />
              <input
                type="text"
                aria-label={`플레이어 ${i + 1} 이름`}
                placeholder={defaultName(i)}
                maxLength={NAME_MAX_LENGTH}
                value={value}
                onChange={(event) => setInput(i, event.target.value)}
              />
            </li>
          ))}
        </ol>
      </div>
      <p className="best">최고 점수 {best ?? "없음"}</p>
      <button type="submit" className="primary">
        {count === 1 ? "혼자 시작" : "대전 시작"}
      </button>
    </form>
  );
}
