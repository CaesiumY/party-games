// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import type { DiceSource } from "../engine/dice-source";
import { CATEGORIES, type DieValue } from "../engine/types";
import { createGameStore, type GameStore } from "../store/game-store";
import { useGame } from "../store/store-context";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

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

/** 플레이어마다 언제나 같은 눈(다섯 개 모두). */
const facesByPlayer =
  (faces: DieValue[]): DiceSource =>
  ({ count, player }) =>
    Array.from({ length: count }, () => faces[player] ?? 1);

function openApp(diceSource: DiceSource = facesByPlayer([6, 6, 6, 6])) {
  const store = createGameStore({ diceSource });
  render(<App store={store} webgl Board={FakeBoard} />);
  // 동작 사이의 setTimeout 대기를 없앤다(클릭마다 쌓이면 테스트 시간 제한을 넘나든다).
  const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
  return { user, store };
}

/**
 * 화면 클릭 대신 저장소 명령으로 남은 턴을 끝까지 진행한다(굴림 → 연출 끝 → 맨 위 빈 카테고리 기록,
 * 보너스 알림은 끝난 것으로). 화면으로 턴을 끝까지 하는 것은 연습 모드 화면 테스트가 맡는다.
 */
function finishGameViaStore(store: GameStore) {
  act(() => {
    const s = () => store.getState();
    while (!s().game.finished) {
      const notice = s().bonusNotice;
      if (notice) s().bonusNoticeEnded(notice.id);
      if (!s().roll().ok) throw new Error("굴릴 수 없다");
      s().presenterStopped(s().rollId);
      s().presenterLinedUp(s().rollId);
      const { game } = s();
      const scores = game.players[game.currentPlayer]?.scores ?? {};
      const empty = CATEGORIES.find((category) => scores[category] === undefined);
      if (!empty || !s().select(empty).ok || !s().record().ok) throw new Error("기록할 수 없다");
    }
    const notice = s().bonusNotice;
    if (notice) s().bonusNoticeEnded(notice.id);
  });
}

const sheet = () => within(screen.getByRole("region", { name: "점수표" }));
/** 판 위의 지금 차례 표시가 보여 주는 이름. */
const currentPlayer = () => document.querySelector(".current-player")?.textContent;
const headers = () =>
  sheet()
    .getAllByRole("columnheader")
    .slice(1)
    .map((h) => h.textContent);

/** 시작 화면에서 인원을 고르고 이름을 넣어 시작한다. 빈 문자열은 비워 둔다. */
async function start(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  await user.click(screen.getByRole("radio", { name: `${names.length}명` }));
  for (const [i, name] of names.entries()) {
    const input = screen.getByRole("textbox", { name: `플레이어 ${i + 1} 이름` });
    await user.clear(input);
    if (name) await user.type(input, name);
  }
  await user.click(
    screen.getByRole("button", { name: names.length === 1 ? "혼자 시작" : "대전 시작" }),
  );
}

describe("대전 모드 시작", () => {
  it("인원을 고르고 이름을 넣어 시작하면 그 순서로 점수표 세로줄이 생긴다. 비운 이름은 「플레이어 n」이다", async () => {
    const { user } = openApp();

    await start(user, ["", "나래"]);

    expect(headers()).toEqual(["플레이어 1", "나래"]);
    expect(currentPlayer()).toBe("플레이어 1");
  });

  it("같은 이름을 두 번 넣으면 뒤의 것에 번호를 붙여 구분한다", async () => {
    const { user } = openApp();

    await start(user, ["가람", " 가람 "]);

    expect(headers()).toEqual(["가람", "가람 2"]);
  });

  it("인원 선택지는 지금은 1~2명이고(3~4명은 닫아 둠), 1명이면 혼자 시작한다", async () => {
    const { user } = openApp();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    for (const n of [1, 2]) expect(screen.getByRole("radio", { name: `${n}명` })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "3명" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "플레이어 3 이름" })).toBeNull();

    await start(user, [""]);

    expect(headers()).toEqual(["플레이어 1"]);
  });
});

describe("차례 넘기기", () => {
  it("기록하면 「다음은 ○○ 차례」 배너가 잠깐 떴다 사라지고, 지금 차례 표시가 다음 플레이어로 바뀐다", async () => {
    const { user } = openApp();
    await start(user, ["가람", "나래"]);

    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    await user.click(sheet().getByRole("button", { name: "초이스" }));
    await user.click(screen.getByRole("button", { name: "기록" }));

    expect(screen.getByText("다음은 나래 차례")).toBeTruthy();
    expect(currentPlayer()).toBe("나래");
    // 배너가 떠 있어도 바로 굴릴 수 있다.
    expect(screen.getByRole("button", { name: "주사위 던지기" })).toHaveProperty("disabled", false);
    // 배너를 놓치지 않게 그동안은 플레이 방법("?")을 열 수 없다.
    expect(screen.getByRole("button", { name: "플레이 방법" })).toHaveProperty("disabled", true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("다음은 나래 차례")).toBeNull();
    expect(screen.getByRole("button", { name: "플레이 방법" })).toHaveProperty("disabled", false);
  });
});

describe("대전 모드 결과", () => {
  it("순위 표(동점이면 같은 순위) → 「다음」 → 승자 화면(공동 1등 모두), 「같은 멤버로 다시」는 같은 이름·순서로 다시 연다", async () => {
    // 두 사람 모두 늘 6(총합 득점 170) → 공동 1위. 3명 이상의 순위(1·1·3)는 엔진 테스트(ranking)가 본다.
    const { user, store } = openApp(facesByPlayer([6, 6]));
    await start(user, ["가람", "나래"]);
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    await user.click(sheet().getByRole("button", { name: "에이스" }));
    await user.click(screen.getByRole("button", { name: "0점으로 기록" }));

    finishGameViaStore(store);

    const ranks = within(screen.getByRole("table", { name: "순위" }));
    const rows = ranks
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ["1위", "가람", "170"],
      ["1위", "나래", "170"],
    ]);
    expect(screen.queryByRole("button", { name: "같은 멤버로 다시" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "다음" }));

    const winner = within(screen.getByRole("main", { name: "Winner!" }));
    expect(winner.getByText("가람")).toBeTruthy();
    expect(winner.getByText("나래")).toBeTruthy();
    expect(winner.getAllByText("총합 득점 170")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "같은 멤버로 다시" }));

    expect(headers()).toEqual(["가람", "나래"]);
    expect(sheet().getByText("턴 1/12")).toBeTruthy();
  });
});

describe("결과 화면의 모드", () => {
  it("연습 모드에서 최고 점수 비교가 없으면(이어 하기로 연 끝난 판 등) 최고 점수 줄 없이 총합 득점만 보여 준다", async () => {
    const { user, store } = openApp(facesByPlayer([6]));
    await start(user, [""]);
    finishGameViaStore(store);
    act(() => {
      store.setState({ outcome: null });
    });

    const result = within(screen.getByRole("main", { name: "결과" }));
    expect(result.getByText("총합 득점 170")).toBeTruthy();
    expect(result.queryByText(/최고 점수/)).toBeNull();
    expect(screen.queryByRole("table", { name: "순위" })).toBeNull();
    expect(result.getByRole("button", { name: "같은 멤버로 다시" })).toBeTruthy();
  });
});
