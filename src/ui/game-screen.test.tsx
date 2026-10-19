// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import { scriptedDiceSource } from "../engine/dice-source";
import type { DieValue } from "../engine/types";
import { createGameStore } from "../store/game-store";
import { useGame } from "../store/store-context";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * 캔버스 없는 판 영역 대역. 순간 배치 연출처럼 굴림마다 멈춤과 정렬 끝을 곧바로 알리고,
 * 자리가 바뀐 주사위도 곧바로 다 옮겼다고 알린다.
 */
function FakeBoard() {
  const rollId = useGame((s) => s.rollId);
  const stopped = useGame((s) => s.presenterStopped);
  const linedUp = useGame((s) => s.presenterLinedUp);
  const moving = useGame((s) => s.movingDice);
  const settled = useGame((s) => s.presenterDieSettled);
  useEffect(() => {
    if (rollId === 0) return;
    stopped(rollId);
    linedUp(rollId);
  }, [rollId, stopped, linedUp]);
  useEffect(() => {
    for (const die of moving) settled(die);
  }, [moving, settled]);
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
      .filter((b) => b.closest("tbody"))
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
    // 머리 첫 칸에는 턴 표시와 플레이 방법 "?" 버튼이 함께 있다.
    expect(
      sheet()
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["턴 1/12?", "플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]);
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
      // 파이브로 소계가 63 을 넘으면 보너스 알림(약 2초)이 끝나야 다음 굴림을 할 수 있다.
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }

    expect(rowOf("소계").getByText("105/63")).toBeTruthy();
    expect(rowOf("보너스+35").getByText("35")).toBeTruthy();
    expect(rowOf("총합 득점").getByText("140")).toBeTruthy();
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

  it("첫 굴림 전에는 눌러도 홀드되지 않는다", async () => {
    const user = userEvent.setup();
    const store = renderGame([]);

    await user.click(diceGroup().getAllByRole("button")[0] as HTMLElement);

    expect(store.getState().game.dice.some((d) => d.held)).toBe(false);
  });

  it("카테고리를 고르면 기여 주사위인지도 읽어 준다. 선택을 옮기면 바뀌고, 기록하면 사라진다", async () => {
    const user = userEvent.setup();
    renderGame([[1, 3, 1, 6, 2]]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    await user.click(diceGroup().getByRole("button", { name: "주사위 6" }));

    await user.click(sheet().getByRole("button", { name: "에이스" }));
    expect(readDice()).toBe(
      "주사위 6↑ 주사위 1, 기여 주사위 주사위 1, 기여 주사위 주사위 2 주사위 3",
    );

    await user.click(sheet().getByRole("button", { name: "식스" }));
    expect(readDice()).toBe("주사위 6, 기여 주사위↑ 주사위 1 주사위 1 주사위 2 주사위 3");

    await user.click(screen.getByRole("button", { name: "기록" }));
    expect(readDice()).not.toContain("기여");
  });
});

describe("성립 알림", () => {
  it("정렬 끝에 성립한 카테고리 이름이 뜨고, 그동안 점수표의 그 칸이 빛나다가 1~1.5초 뒤 사라진다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGame([[2, 3, 4, 5, 1]]);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    expect(screen.getByRole("status").textContent).toBe("L. 스트레이트");
    const cell = rowOf("L. 스트레이트").getAllByRole("cell")[0];
    expect(cell?.classList.contains("callout")).toBe(true);
    // 알림이 떠 있어도 조작할 수 있다.
    expect(screen.getByRole("button", { name: "다시 던지기" })).toHaveProperty("disabled", false);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(cell?.classList.contains("callout")).toBe(false);
  });

  it("이미 기록한 카테고리면 이름은 뜨지만 칸은 빛나지 않는다", async () => {
    const user = userEvent.setup();
    renderGame([
      [4, 4, 4, 4, 4],
      [5, 5, 5, 5, 5],
    ]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    await user.click(sheet().getByRole("button", { name: "요트" }));
    await user.click(screen.getByRole("button", { name: "기록" }));

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

    expect(screen.getByRole("status").textContent).toBe("요트");
    const cell = rowOf("요트").getAllByRole("cell")[0];
    expect(cell?.classList.contains("callout")).toBe(false);
  });

  it("요트면 색종이가 터진다. 다른 카테고리면 터지지 않는다", async () => {
    const user = userEvent.setup();
    const store = renderGame([[3, 3, 3, 3, 1], [3]]);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    expect(screen.getByRole("status").textContent).toBe("포 다이스");
    expect(screen.queryByTestId("confetti")).toBeNull();
    act(() => {
      for (const id of [0, 1, 2, 3] as const) store.getState().toggleHold(id);
    });

    await user.click(screen.getByRole("button", { name: "다시 던지기" }));
    expect(screen.getByRole("status").textContent).toBe("요트");
    expect(screen.getByTestId("confetti")).toBeTruthy();
  });

  it("'동작 줄이기'가 켜져 있으면 요트여도 색종이를 띄우지 않는다", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener() {},
      removeEventListener() {},
    }));
    try {
      const user = userEvent.setup();
      renderGame([[6, 6, 6, 6, 6]]);

      await user.click(screen.getByRole("button", { name: "주사위 던지기" }));

      expect(screen.getByRole("status").textContent).toBe("요트");
      expect(screen.queryByTestId("confetti")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("보너스 알림", () => {
  it("소계가 처음 63 이상이 되면 「보너스!」→「+35」가 뜨고, 끝날 때까지 방금 기록한 플레이어의 차례로 보이며 굴릴 수 없다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const sixes = [6, 6, 6, 6, 6] as DieValue[];
    const fives = [5, 5, 5, 5, 5] as DieValue[];
    const ones = [1, 1, 1, 1, 1] as DieValue[];
    renderGame([sixes, ones, fives, ones, [4, 4, 4, 4, 4]], ["플레이어 1", "플레이어 2"]);
    const turn = async (name: string) => {
      await user.click(screen.getByRole("button", { name: /던지기/ }));
      await user.click(sheet().getByRole("button", { name }));
      await user.click(screen.getByRole("button", { name: "기록" }));
    };
    const current = () => document.querySelector(".current-player")?.textContent;
    await turn("식스");
    await turn("에이스");
    await turn("파이브");
    await turn("초이스");
    expect(current()).toBe("플레이어 1");

    await turn("포");

    expect(screen.getByRole("status").textContent).toBe("보너스!");
    expect(current()).toBe("플레이어 1");
    expect(rowOf("소계").getAllByRole("cell")[0]?.classList.contains("bonus")).toBe(true);
    expect(screen.getByRole("button", { name: "주사위 던지기" })).toHaveProperty("disabled", true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("status").textContent).toBe("+35");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(current()).toBe("플레이어 2");
    expect(rowOf("소계").getAllByRole("cell")[0]?.classList.contains("bonus")).toBe(false);
    expect(screen.getByRole("button", { name: "주사위 던지기" })).toHaveProperty("disabled", false);
  });

  it("윗칸을 다 채웠는데 63 미만이면 「+0」만 뜨고, 알림 내내(약 2초) 한 번의 연출로 보인다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGame(Array.from({ length: 6 }, () => [1, 2, 3, 4, 6] as DieValue[]));
    for (const name of ["에이스", "듀스", "트레이", "포", "파이브", "식스"]) {
      await user.click(screen.getByRole("button", { name: /던지기/ }));
      await user.click(sheet().getByRole("button", { name }));
      await user.click(screen.getByRole("button", { name: /기록/ }));
    }

    const text = screen.getByText("+0");
    expect(screen.getByRole("status").textContent).toBe("+0");
    // 나타났다 사라지는 연출 길이가 알림 길이와 같아야 끝나기 전에 사라지지 않는다.
    expect(text.style.animationDuration).toBe("2000ms");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("+0")).toBe(text);
  });

  it("「보너스!」와 「+35」는 각각 떠 있는 1초 동안의 연출로 보인다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGame(Array.from({ length: 6 }, (_, i) => Array(5).fill(i + 1) as DieValue[]));
    for (const name of ["에이스", "듀스", "트레이", "포", "파이브"]) {
      await user.click(screen.getByRole("button", { name: /던지기/ }));
      await user.click(sheet().getByRole("button", { name }));
      await user.click(screen.getByRole("button", { name: /기록/ }));
    }

    expect(screen.getByText("보너스!").style.animationDuration).toBe("1000ms");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("+35").style.animationDuration).toBe("1000ms");
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
