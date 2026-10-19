// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentType, useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app";
import { scriptedDiceSource } from "../engine/dice-source";
import type { DieValue } from "../engine/types";
import { createGameStore } from "../store/game-store";
import { useGame } from "../store/store-context";

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

/** 아무것도 알리지 않는 판 영역 대역. 테스트가 멈춤·정렬 끝을 직접 알린다. */
function SilentBoard() {
  return <div className="board" />;
}

function renderApp({
  rolls = [],
  players,
  Board = FakeBoard,
}: {
  rolls?: DieValue[][];
  players?: string[];
  Board?: ComponentType;
}) {
  const store = createGameStore({ players, diceSource: scriptedDiceSource(rolls) });
  render(<App store={store} webgl Board={Board} />);
  return store;
}

const dialog = () => within(screen.getByRole("dialog", { name: "플레이 방법" }));

describe("시작 화면에서 여는 플레이 방법", () => {
  it("「플레이 방법」·「족보」·「힌트」 세 탭을 차례로 볼 수 있다", async () => {
    const user = userEvent.setup();
    renderApp({});

    await user.click(screen.getByRole("button", { name: "플레이 방법" }));

    expect(
      dialog()
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["플레이 방법", "족보", "힌트"]);
    expect(dialog().getByRole("tabpanel").textContent).toContain("다시 던지기는 2번까지!");

    await user.click(dialog().getByRole("tab", { name: "족보" }));
    expect(dialog().getByRole("tab", { name: "족보" }).getAttribute("aria-selected")).toBe("true");
    expect(dialog().getByRole("tabpanel").textContent).toContain("주사위 눈 1의 합계");

    await user.click(dialog().getByRole("tab", { name: "힌트" }));
    expect(dialog().getByRole("tabpanel").textContent).toContain("63");
  });

  it("족보 탭은 12개 카테고리를 점수표 이름으로 예시 점수와 함께 보여 주고, 끝에 윗칸 보너스를 적는다", async () => {
    const user = userEvent.setup();
    renderApp({});
    await user.click(screen.getByRole("button", { name: "플레이 방법" }));
    await user.click(dialog().getByRole("tab", { name: "족보" }));

    const items = within(dialog().getByRole("tabpanel")).getAllByRole("listitem");
    const read = items.map((item) =>
      `${item.querySelector("h3")?.textContent} ${[...item.querySelectorAll(".example")]
        .map((e) => e.getAttribute("aria-label"))
        .join(" / ")}`.trim(),
    );

    expect(read).toEqual([
      "에이스 주사위 1 1 3 4 6, 2점",
      "듀스 주사위 2 2 2 5 6, 6점",
      "트레이 주사위 1 3 3 4 6, 6점",
      "포 주사위 2 4 4 5 6, 8점",
      "파이브 주사위 1 5 5 5 6, 15점",
      "식스 주사위 2 3 6 6 6, 18점",
      "초이스 주사위 2 3 4 6 6, 21점",
      "포 다이스 주사위 3 3 3 3 5, 17점",
      "풀 하우스 주사위 2 2 5 5 5, 19점 / 주사위 6 6 6 6 6, 30점",
      "S. 스트레이트 주사위 1 2 3 4 6, 15점",
      "L. 스트레이트 주사위 2 3 4 5 6, 30점",
      "요트 주사위 4 4 4 4 4, 50점",
      "보너스+35",
    ]);
    expect(items.at(-1)?.textContent).toContain("63점 이상");
  });

  it("Esc 로 닫으면 포커스가 연 버튼으로 돌아간다", async () => {
    const user = userEvent.setup();
    renderApp({});
    const opener = screen.getByRole("button", { name: "플레이 방법" });

    await user.click(opener);
    expect(dialog().getByRole("button", { name: "닫기" })).toBeTruthy();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('게임 중 "?" 로 여는 플레이 방법', () => {
  it('점수표 머리의 "?" 로 열고 닫기 버튼으로 닫으면, 턴·주사위·홀드·선택이 연 때와 같고 포커스가 "?" 로 돌아간다', async () => {
    const user = userEvent.setup();
    const store = renderApp({ rolls: [[2, 2, 5, 5, 5]], players: ["가", "나"] });
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    store.getState().toggleHold(0);
    store.getState().select("fullHouse");
    const before = store.getState();

    const sheet = within(screen.getByRole("region", { name: "점수표" }));
    const opener = sheet.getByRole("button", { name: "플레이 방법" });
    expect(opener.textContent).toBe("?");
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "플레이 방법" })).toBeTruthy();
    await user.click(dialog().getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    const after = store.getState();
    expect([after.game, after.selection, after.columns, after.rollId]).toEqual([
      before.game,
      before.selection,
      before.columns,
      before.rollId,
    ]);
  });

  it('굴림 버튼을 누른 때부터 정렬 끝까지 "?" 버튼이 잠긴다', async () => {
    const user = userEvent.setup();
    const store = renderApp({ rolls: [[1, 2, 3, 4, 5]], players: ["가"], Board: SilentBoard });
    const opener = () =>
      within(screen.getByRole("region", { name: "점수표" })).getByRole("button", {
        name: "플레이 방법",
      }) as HTMLButtonElement;
    expect(opener().disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    expect(opener().disabled).toBe(true);

    act(() => {
      const { presentation } = store.getState();
      if (presentation.phase === "idle") throw new Error("연출 중이 아니다");
      store.getState().presenterStopped(presentation.rollId);
      store.getState().presenterLinedUp(presentation.rollId);
    });
    expect(opener().disabled).toBe(false);
  });
});
