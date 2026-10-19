// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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

function renderGame(rolls: DieValue[][], players = ["플레이어 1"]) {
  const store = createGameStore({ players, diceSource: scriptedDiceSource(rolls) });
  render(<App store={store} webgl Board={FakeBoard} />);
  return store;
}

const sheet = () => within(screen.getByRole("region", { name: "점수표" }));
const rowOf = (name: string) => {
  const row = sheet().getByRole("button", { name }).closest("tr");
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

  it("점수 계산이 아직 없는 카테고리는 고를 수 없다", async () => {
    const user = userEvent.setup();
    renderGame([[1, 1, 1, 1, 1]]);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    expect(sheet().getByRole("button", { name: "요트" })).toHaveProperty("disabled", true);
  });
});

describe("보이지 않는 주사위 버튼", () => {
  const diceGroup = () => within(screen.getByRole("group", { name: "주사위" }));
  /** 화면 순서대로 [이름, 홀드 여부]. */
  const readDice = () =>
    diceGroup()
      .getAllByRole("button")
      .map((b) => `${b.textContent}${b.getAttribute("aria-pressed") === "true" ? "↑" : ""}`)
      .join(" ");

  it("화면과 같은 순서(홀드 자리 → 정렬 줄, 각각 왼쪽 열부터)로 눈과 홀드 여부를 읽어 주고, 누르면 홀드를 토글한다", async () => {
    const user = userEvent.setup();
    renderGame([[5, 1, 4, 1, 3]]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    expect(readDice()).toBe("주사위 1 주사위 1 주사위 3 주사위 4 주사위 5");

    await user.click(diceGroup().getByRole("button", { name: "주사위 4" }));
    await user.click(diceGroup().getByRole("button", { name: "주사위 3" }));

    expect(readDice()).toBe("주사위 3↑ 주사위 4↑ 주사위 1 주사위 1 주사위 5");
    await user.click(diceGroup().getByRole("button", { name: "주사위 4" }));
    expect(readDice()).toBe("주사위 3↑ 주사위 1 주사위 1 주사위 4 주사위 5");
  });

  it("다섯 개를 모두 홀드하면 굴림 버튼이 비활성화된다", async () => {
    const user = userEvent.setup();
    renderGame([[2, 2, 2, 2, 2]]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    for (const button of diceGroup().getAllByRole("button")) await user.click(button);

    expect(readDice()).toBe("주사위 2↑ 주사위 2↑ 주사위 2↑ 주사위 2↑ 주사위 2↑");
    expect(screen.getByRole("button", { name: "다시 던지기" })).toHaveProperty("disabled", true);
  });

  it("3번째 굴림 뒤에는 굴림 버튼이 사라지고, 주사위 버튼은 홀드 토글 없이 눈만 오름차순으로 읽어 준다", async () => {
    const user = userEvent.setup();
    const store = renderGame([
      [5, 3, 6, 4, 5],
      [3, 4],
      [1, 2],
    ]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    for (const id of [0, 2, 4] as const) store.getState().toggleHold(id);
    await user.click(screen.getByRole("button", { name: "다시 던지기" }));
    await user.click(screen.getByRole("button", { name: "다시 던지기" }));

    expect(screen.queryByRole("button", { name: "다시 던지기" })).toBeNull();
    const buttons = diceGroup().getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "주사위 1",
      "주사위 2",
      "주사위 5",
      "주사위 5",
      "주사위 6",
    ]);
    expect(buttons.every((b) => b.getAttribute("aria-pressed") === null)).toBe(true);
    expect(buttons.every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);

    await user.click(buttons[0] as HTMLElement);
    expect(store.getState().game.dice.map((d) => d.held)).toEqual([true, false, true, false, true]);
  });

  it("첫 굴림 전과 굴림 연출 중에는 눌러도 홀드되지 않는다", async () => {
    const user = userEvent.setup();
    const store = renderGame([]);

    await user.click(diceGroup().getAllByRole("button")[0] as HTMLElement);

    expect(store.getState().game.dice.some((d) => d.held)).toBe(false);
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
