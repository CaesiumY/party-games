// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import type { DiceSource } from "../engine/dice-source";
import { CATEGORIES, type DieValue } from "../engine/types";
import { bestScoreValue } from "../store/best-score";
import { createGameStore, type GameStore } from "../store/game-store";
import { savedGameValue } from "../store/saved-game";
import { useGame } from "../store/store-context";
import { type KeyValueStorage, memoryStorage } from "../store/stored-value";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

/** 다섯 개 모두 6. 굴림이 끝나면 요트 성립 알림이 뜬다. */
const allSixes: DiceSource = ({ count }) => Array.from({ length: count }, (): DieValue => 6);

function createStore(storage: KeyValueStorage) {
  return createGameStore({
    diceSource: allSixes,
    bestScore: bestScoreValue(storage),
    savedGame: savedGameValue(storage),
  });
}

/** 새로고침처럼 같은 저장소로 앱을 처음부터 연다. */
function openApp(storage: KeyValueStorage): GameStore {
  cleanup();
  const store = createStore(storage);
  render(<App store={store} webgl Board={FakeBoard} />);
  return store;
}

function setupUser() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
}

/**
 * 화면 없이 저장소 명령으로 게임 도중까지 진행해 둔다(굴림 → 연출 끝 → 맨 위 빈 카테고리 기록을 `turns` 번,
 * 보너스 알림은 끝난 것으로). 그다음 한 번 굴리고 연출 도중에 멈춘다. 저장소에 진행 중 게임이 남는다.
 */
function playUntilRolling(storage: KeyValueStorage, names: string[], turns: number) {
  const store = createStore(storage);
  const s = () => store.getState();
  s().newGame(names);
  for (let i = 0; i < turns; i++) {
    if (!s().roll().ok) throw new Error("굴릴 수 없다");
    s().presenterStopped(s().rollId);
    s().presenterLinedUp(s().rollId);
    const { game } = s();
    const scores = game.players[game.currentPlayer]?.scores ?? {};
    const empty = CATEGORIES.find((category) => scores[category] === undefined);
    if (!empty || !s().select(empty).ok || !s().record().ok) throw new Error("기록할 수 없다");
    const notice = s().bonusNotice;
    if (notice) s().bonusNoticeEnded(notice.id);
  }
  s().roll();
  return store;
}

const sheet = () => within(screen.getByRole("region", { name: "점수표" }));
const rowOf = (name: string) => {
  const row = sheet().getByRole("rowheader", { name }).closest("tr");
  if (!row) throw new Error(`${name} 줄이 없다`);
  return within(row);
};

describe("시작 화면의 이어 하기", () => {
  it("이어 할 게임이 없으면 이어 하기 없이 인원과 이름을 고른다", () => {
    openApp(memoryStorage());

    expect(screen.queryByRole("button", { name: "이어 하기" })).toBeNull();
    expect(screen.getByRole("button", { name: "혼자 시작" })).toBeTruthy();
  });

  it("1인 게임 도중 새로고침하면 이어 하기로 같은 턴·점수표·주사위에서 이어 한다", async () => {
    const storage = memoryStorage();
    playUntilRolling(storage, ["플레이어 1"], 2);
    openApp(storage);
    const user = setupUser();

    expect(screen.queryByRole("button", { name: "혼자 시작" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "이어 하기" }));

    expect(sheet().getByText("턴 3/12")).toBeTruthy();
    // 기록한 점수(에이스 0, 듀스 0)와, 굴림 결과의 점수 미리보기가 바로 보인다.
    expect(rowOf("트레이").getByText("0")).toBeTruthy();
    expect(rowOf("식스").getByText("30")).toBeTruthy();
    expect(rowOf("요트").getByText("50")).toBeTruthy();
    expect(screen.getByText("앞으로 2번")).toBeTruthy();
    // 조작이 잠기지 않는다.
    expect(screen.getByRole("button", { name: "다시 던지기" })).toHaveProperty("disabled", false);
    // 성립 알림·색종이는 다시 띄우지 않는다.
    expect(screen.queryByRole("status", { name: "요트" })).toBeNull();
    expect(screen.queryByTestId("confetti")).toBeNull();
  });

  it("2인 게임 도중 새로고침해도 지금 차례인 플레이어에서 이어 하고, 차례 배너는 띄우지 않는다", async () => {
    const storage = memoryStorage();
    playUntilRolling(storage, ["가", "나"], 3);
    openApp(storage);
    const user = setupUser();

    await user.click(screen.getByRole("button", { name: "이어 하기" }));

    expect(sheet().getByText("턴 2/12")).toBeTruthy();
    expect(document.querySelector(".current-player")?.textContent).toContain("나");
    expect(document.querySelector(".turn-banner")).toBeNull();
    expect(screen.getByRole("button", { name: "다시 던지기" })).toHaveProperty("disabled", false);
  });

  it("새 게임을 고르면 인원과 이름을 골라 새로 시작하고, 이어 하던 게임은 사라진다", async () => {
    const storage = memoryStorage();
    playUntilRolling(storage, ["가", "나"], 3);
    openApp(storage);
    const user = setupUser();

    await user.click(screen.getByRole("button", { name: "새 게임" }));
    expect(screen.queryByRole("button", { name: "이어 하기" })).toBeNull();
    // 이어 하던 게임의 인원과 이름이 채워져 있다.
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "플레이어 2 이름" }).value).toBe(
      "나",
    );
    await user.click(screen.getByRole("button", { name: "대전 시작" }));

    expect(sheet().getByText("턴 1/12")).toBeTruthy();
    openApp(storage);
    expect(screen.getByRole("button", { name: "이어 하기" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "이어 하기" }));
    expect(sheet().getByText("턴 1/12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "주사위 던지기" })).toBeTruthy();
  });

  it("게임이 끝나면 다시 열어도 이어 하기가 없다", () => {
    const storage = memoryStorage();
    const store = playUntilRolling(storage, ["플레이어 1"], 11);
    act(() => {
      const s = store.getState();
      s.presenterStopped(s.rollId);
      s.presenterLinedUp(s.rollId);
      store.getState().select("yacht");
      store.getState().record();
    });
    expect(store.getState().game.finished).toBe(true);

    openApp(storage);
    expect(screen.queryByRole("button", { name: "이어 하기" })).toBeNull();
  });
});
