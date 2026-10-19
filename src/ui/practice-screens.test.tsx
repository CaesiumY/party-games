// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app";
import type { DiceSource } from "../engine/dice-source";
import { CATEGORIES, type DieValue } from "../engine/types";
import { bestScoreValue } from "../store/best-score";
import { createGameStore, type GameStore } from "../store/game-store";
import { useGame } from "../store/store-context";
import { type KeyValueStorage, memoryStorage } from "../store/stored-value";

afterEach(cleanup);

/** 캔버스 없는 판 영역 대역. 굴림마다 멈춤과 정렬 끝을 곧바로 알린다. */
function FakeBoard() {
  const rollId = useGame((s) => s.rollId);
  const stopped = useGame((s) => s.presenterStopped);
  const linedUp = useGame((s) => s.presenterLinedUp);
  useEffect(() => {
    if (rollId === 0) return;
    stopped(rollId);
    linedUp(rollId);
  }, [rollId, stopped, linedUp]);
  return <div className="board" />;
}

/** 언제나 다섯 개 모두 6. 맨 위 빈 카테고리부터 채우면 총합 득점 170이다. */
const allSixes: DiceSource = ({ count }) => Array.from({ length: count }, (): DieValue => 6);

function storageWithBest(best: number | null): KeyValueStorage {
  const storage = memoryStorage();
  if (best !== null) bestScoreValue(storage).write(best);
  return storage;
}

/** 새로고침처럼 같은 저장소로 앱을 처음부터 연다. */
function openApp(storage: KeyValueStorage): GameStore {
  cleanup();
  const store = createGameStore({ diceSource: allSixes, bestScore: bestScoreValue(storage) });
  render(<App store={store} webgl Board={FakeBoard} />);
  return store;
}

/**
 * 화면 클릭 대신 저장소 명령으로 남은 턴을 끝까지 진행한다(굴림 → 연출 끝 → 맨 위 빈 카테고리 기록).
 * 화면으로 한 판을 다 하는 것은 첫 판 테스트가 맡는다. jsdom 에서 화면으로 12턴을 두 번 하면
 * 테스트 시간 제한(5초)을 넘나들어서, 그 밖의 테스트는 끝 상태까지 이렇게 간다.
 */
function finishGameViaStore(store: GameStore) {
  act(() => {
    const s = () => store.getState();
    while (!s().game.finished) {
      if (!s().roll().ok) throw new Error("굴릴 수 없다");
      s().presenterStopped(s().rollId);
      s().presenterLinedUp(s().rollId);
      const { game } = s();
      const scores = game.players[game.currentPlayer]?.scores ?? {};
      const empty = CATEGORIES.find((category) => scores[category] === undefined);
      if (!empty || !s().select(empty).ok || !s().record().ok) throw new Error("기록할 수 없다");
    }
  });
}

const sheet = () => within(screen.getByRole("region", { name: "점수표" }));

/** 12턴 동안 굴리고 맨 위 빈 카테고리에 기록한다. */
async function playTwelveTurns(user: ReturnType<typeof userEvent.setup>) {
  for (let turn = 1; turn <= 12; turn++) {
    expect(sheet().getByText(`턴 ${turn}/12`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    const empty = sheet()
      .getAllByRole("button")
      .filter((button) => button.closest("tbody"))
      .find((button) => !(button as HTMLButtonElement).disabled);
    if (!empty) throw new Error("고를 수 있는 카테고리가 없다");
    await user.click(empty);
    await user.click(screen.getByRole("button", { name: /기록/ }));
  }
}

describe("시작 화면", () => {
  it("혼자 시작하는 버튼과 이 기기의 최고 점수를 보여 준다", () => {
    openApp(storageWithBest(150));

    expect(screen.getByRole("button", { name: "혼자 시작" })).toBeTruthy();
    expect(screen.getByText("최고 점수 150")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "점수표" })).toBeNull();
  });

  it("최고 점수가 아직 없으면 없다고 알린다", () => {
    openApp(storageWithBest(null));

    expect(screen.getByText("최고 점수 없음")).toBeTruthy();
  });
});

describe("연습 모드 한 판", () => {
  it("혼자 시작해 12턴을 마치면 결과 화면에 총합 득점과 새 최고 점수가 뜨고, 새로고침해도 최고 점수가 남는다", async () => {
    // 동작 사이의 setTimeout 대기를 없앤다. 클릭마다 수십 ms 씩 쌓여 12턴이면 2초를 넘었다.
    const user = userEvent.setup({ delay: null });
    const storage = storageWithBest(120);
    openApp(storage);

    await user.click(screen.getByRole("button", { name: "혼자 시작" }));
    await playTwelveTurns(user);

    const result = within(screen.getByRole("main", { name: "결과" }));
    expect(result.getByText("총합 득점 170")).toBeTruthy();
    expect(result.getByText("최고 점수 170")).toBeTruthy();
    expect(result.getByText("새 최고 점수!")).toBeTruthy();

    openApp(storage);
    expect(screen.getByText("최고 점수 170")).toBeTruthy();
  });

  it("「같은 멤버로 다시」는 첫 턴부터 새 게임을, 「처음으로」는 시작 화면을 연다", async () => {
    const user = userEvent.setup({ delay: null });
    const store = openApp(storageWithBest(300));
    await user.click(screen.getByRole("button", { name: "혼자 시작" }));
    finishGameViaStore(store);
    expect(screen.getByRole("main", { name: "결과" })).toBeTruthy();
    expect(screen.queryByText("새 최고 점수!")).toBeNull();
    expect(screen.getByText("최고 점수 300")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "같은 멤버로 다시" }));

    expect(sheet().getByText("턴 1/12")).toBeTruthy();
    expect(sheet().getByRole("columnheader", { name: "플레이어 1" })).toBeTruthy();
    expect(screen.queryByRole("main", { name: "결과" })).toBeNull();

    finishGameViaStore(store);
    await user.click(screen.getByRole("button", { name: "처음으로" }));

    expect(screen.getByRole("button", { name: "혼자 시작" })).toBeTruthy();
    expect(screen.getByText("최고 점수 300")).toBeTruthy();
  });
});
