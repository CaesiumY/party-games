// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app";
import { scriptedDiceSource } from "../engine/dice-source";
import type { DieValue } from "../engine/types";
import { createGameStore } from "../store/game-store";
import { useGame } from "../store/store-context";

afterEach(cleanup);

/** 캔버스 없는 판 영역 대역. 순간 배치 연출처럼 굴림마다 멈춤과 정렬 끝을 곧바로 알린다. */
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

/** 아무것도 알리지 않는 판 영역 대역. 테스트가 멈춤·정렬 끝을 직접 알린다. */
function SilentBoard() {
  return <div className="board" />;
}

function renderGame(rolls: DieValue[][], players = ["플레이어 1"]) {
  const store = createGameStore({ players, diceSource: scriptedDiceSource(rolls) });
  render(<App store={store} webgl Board={FakeBoard} />);
  return store;
}

const sheet = () => within(screen.getByRole("region", { name: "점수표" }));
const rowOf = (name: string) => {
  const row = sheet().getByRole("rowheader", { name }).closest("tr");
  if (!row) throw new Error(`${name} 줄이 없다`);
  return within(row);
};

describe("게임 화면", () => {
  it("점수표에 용어집 표기 그대로의 카테고리 열두 개와 소계·보너스·총합 득점, 턴 표시가 있다", () => {
    renderGame([], ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]);

    const names = sheet()
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toEqual([
      "에이스",
      "듀스",
      "트레이",
      "포",
      "파이브",
      "식스",
      "초이스",
      "포 다이스",
      "풀 하우스",
      "S. 스트레이트",
      "L. 스트레이트",
      "요트",
    ]);
    for (const label of ["소계", "보너스+35", "총합 득점", "턴 1/12"]) {
      expect(sheet().getByText(label)).toBeTruthy();
    }
    expect(
      sheet()
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["턴 1/12", "플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]);
  });

  it("주사위를 던지고 초이스를 골라 기록하면 다섯 눈의 합이 점수표에 적힌다", async () => {
    const user = userEvent.setup();
    renderGame([[3, 4, 5, 6, 6]]);
    expect(screen.getByText("앞으로 3번")).toBeTruthy();
    expect(sheet().getByRole("button", { name: "초이스" })).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    expect(screen.getByRole("button", { name: "다시 던지기" })).toBeTruthy();
    expect(screen.getByText("앞으로 2번")).toBeTruthy();
    expect(rowOf("초이스").getByText("24")).toBeTruthy();

    await user.click(sheet().getByRole("button", { name: "초이스" }));
    expect(sheet().getByRole("button", { name: "초이스" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await user.click(screen.getByRole("button", { name: "기록" }));

    expect(rowOf("초이스").getByText("24")).toBeTruthy();
    expect(sheet().getByText("턴 2/12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "주사위 던지기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "기록" })).toHaveProperty("disabled", true);
  });
});

describe("점수 미리보기와 기록", () => {
  it("굴림 뒤 빈 카테고리마다 점수 미리보기가 뜨고, 고른 카테고리에 그 값이 그대로 기록된다", async () => {
    const user = userEvent.setup();
    renderGame([[1, 1, 2, 3, 4]]);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    expect(rowOf("에이스").getByText("2")).toBeTruthy();
    expect(rowOf("S. 스트레이트").getByText("15")).toBeTruthy();
    expect(rowOf("풀 하우스").getByText("0")).toBeTruthy();

    await user.click(sheet().getByRole("button", { name: "S. 스트레이트" }));
    await user.click(screen.getByRole("button", { name: "기록" }));

    expect(rowOf("S. 스트레이트").getByText("15")).toBeTruthy();
    expect(rowOf("총합 득점").getByText("15")).toBeTruthy();
    // 다음 턴의 첫 굴림 전에는 미리보기가 없다.
    expect(rowOf("에이스").queryByText("2")).toBeNull();
  });

  it("점수 미리보기는 굴러가는 동안 숨어 있다가 주사위가 멈추는 순간 나타난다", async () => {
    const user = userEvent.setup();
    const store = createGameStore({
      players: ["플레이어 1"],
      diceSource: scriptedDiceSource([[6, 6, 6, 6, 6]]),
    });
    render(<App store={store} webgl Board={SilentBoard} />);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    expect(rowOf("요트").queryByText("50")).toBeNull();

    act(() => store.getState().presenterStopped(store.getState().rollId));

    expect(rowOf("요트").getByText("50")).toBeTruthy();
  });

  it("다른 카테고리를 탭하면 선택이 옮겨 가고, 다시 던지면 선택이 지워진다", async () => {
    const user = userEvent.setup();
    renderGame([
      [1, 1, 2, 3, 4],
      [5, 5, 5, 5, 5],
    ]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    const pressed = (name: string) =>
      sheet().getByRole("button", { name }).getAttribute("aria-pressed");

    await user.click(sheet().getByRole("button", { name: "에이스" }));
    await user.click(sheet().getByRole("button", { name: "듀스" }));
    expect([pressed("에이스"), pressed("듀스")]).toEqual(["false", "true"]);

    await user.click(screen.getByRole("button", { name: "다시 던지기" }));
    expect(pressed("듀스")).toBe("false");
    expect(screen.getByRole("button", { name: "기록" })).toHaveProperty("disabled", true);
  });

  it("성립하지 않는 카테고리를 고르면 버튼이 「0점으로 기록」이 되고, 누르면 0점이 기록된다", async () => {
    const user = userEvent.setup();
    renderGame([[1, 1, 2, 3, 4]]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    await user.click(sheet().getByRole("button", { name: "L. 스트레이트" }));
    expect(screen.queryByRole("button", { name: "기록" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "0점으로 기록" }));

    expect(rowOf("L. 스트레이트").getByText("0")).toBeTruthy();
    expect(sheet().getByText("턴 2/12")).toBeTruthy();
  });

  it("이미 기록한 카테고리는 다시 고를 수 없다", async () => {
    const user = userEvent.setup();
    renderGame([
      [6, 6, 6, 6, 6],
      [6, 6, 6, 6, 6],
    ]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    await user.click(sheet().getByRole("button", { name: "요트" }));
    await user.click(screen.getByRole("button", { name: "기록" }));

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    expect(sheet().getByRole("button", { name: "요트" })).toHaveProperty("disabled", true);
    expect(sheet().getByRole("button", { name: "식스" })).toHaveProperty("disabled", false);
  });

  it("윗칸을 채우면 소계가 「n/63」으로 오르고, 63 이상이면 보너스+35 줄에 35가 붙어 총합 득점에 더해진다", async () => {
    const user = userEvent.setup();
    const upper = [
      ["에이스", 1],
      ["듀스", 2],
      ["트레이", 3],
      ["포", 4],
      ["파이브", 5],
      ["식스", 6],
    ] as const;
    renderGame(upper.map(([, face]) => [face, face, face, face, face]));

    for (const [name] of upper) {
      await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
      await user.click(sheet().getByRole("button", { name }));
      await user.click(screen.getByRole("button", { name: "기록" }));
      if (name === "포") {
        expect(rowOf("소계").getByText("50/63")).toBeTruthy();
        expect(rowOf("보너스+35").queryByText("35")).toBeNull();
      }
    }

    expect(rowOf("소계").getByText("105/63")).toBeTruthy();
    expect(rowOf("보너스+35").getByText("35")).toBeTruthy();
    expect(rowOf("총합 득점").getByText("140")).toBeTruthy();
  });
});

describe("WebGL 을 쓸 수 없을 때", () => {
  it("게임 화면 대신 안내만 보인다", () => {
    const store = createGameStore({ players: ["플레이어 1"], diceSource: scriptedDiceSource([]) });
    render(<App store={store} webgl={false} />);

    expect(screen.getByRole("alert").textContent).toBe("이 기기에서는 3D를 지원하지 않습니다.");
    expect(screen.queryByRole("region", { name: "점수표" })).toBeNull();
  });
});
