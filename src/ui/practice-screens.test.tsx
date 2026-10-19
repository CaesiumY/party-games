// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import type { DiceSource } from "../engine/dice-source";
import type { DieValue } from "../engine/types";
import { bestScoreValue } from "../store/best-score";
import { createGameStore } from "../store/game-store";
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

/** 언제나 다섯 개 모두 6. 맨 위 빈 카테고리부터 채우면 총합 득점 170이다. */
const allSixes: DiceSource = ({ count }) => Array.from({ length: count }, (): DieValue => 6);

function storageWithBest(best: number | null): KeyValueStorage {
  const storage = memoryStorage();
  if (best !== null) bestScoreValue(storage).write(best);
  return storage;
}

/** 새로고침처럼 같은 저장소로 앱을 처음부터 연다. */
function openApp(storage: KeyValueStorage) {
  cleanup();
  const store = createGameStore({ diceSource: allSixes, bestScore: bestScoreValue(storage) });
  render(<App store={store} webgl Board={FakeBoard} />);
}

const sheet = () => within(screen.getByRole("region", { name: "점수표" }));

/** 가짜 시계로 알림 시간을 넘길 수 있는 사용자. 보너스 알림은 약 2초 동안 굴림을 막는다. */
function setupUser() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/**
 * 12턴 동안 굴리고 맨 위 빈 카테고리에 기록한다. 기록마다 알림(보너스 알림 약 2초)이 끝날 만큼 기다린다.
 * 맨 위부터 채우면 6턴째 식스 기록이 윗칸을 다 채워 「+0」 보너스 알림이 뜬다.
 */
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
    act(() => {
      vi.advanceTimersByTime(2000);
    });
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
    const user = setupUser();
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
    const user = setupUser();
    openApp(storageWithBest(300));
    await user.click(screen.getByRole("button", { name: "혼자 시작" }));
    await playTwelveTurns(user);
    expect(screen.queryByText("새 최고 점수!")).toBeNull();
    expect(screen.getByText("최고 점수 300")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "같은 멤버로 다시" }));

    expect(sheet().getByText("턴 1/12")).toBeTruthy();
    expect(sheet().getByRole("columnheader", { name: "플레이어 1" })).toBeTruthy();
    expect(screen.queryByRole("main", { name: "결과" })).toBeNull();

    await playTwelveTurns(user);
    await user.click(screen.getByRole("button", { name: "처음으로" }));

    expect(screen.getByRole("button", { name: "혼자 시작" })).toBeTruthy();
    expect(screen.getByText("최고 점수 300")).toBeTruthy();
  });
});
