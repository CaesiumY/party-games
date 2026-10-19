import { describe, expect, it } from "vitest";
import { scriptedDiceSource } from "../engine/dice-source";
import type { DieValue } from "../engine/types";
import { createGameStore } from "./game-store";

function storeWith(rolls: DieValue[][], players = ["플레이어 1"]) {
  return createGameStore({ players, diceSource: scriptedDiceSource(rolls) });
}

/** 연출 입구가 멈춤과 정렬 끝을 알린 것처럼 한다. */
function finishPresentation(store: ReturnType<typeof storeWith>) {
  const { presentation } = store.getState();
  if (presentation.phase === "idle") throw new Error("연출 중이 아니다");
  store.getState().presenterStopped(presentation.rollId);
  store.getState().presenterLinedUp(presentation.rollId);
}

/** 연출 입구가 옮겨 가던 주사위를 모두 다 옮겼다고 알린 것처럼 한다. */
function settleMoves(store: ReturnType<typeof storeWith>) {
  for (const die of store.getState().movingDice) store.getState().presenterDieSettled(die);
}

describe("굴림부터 기록까지", () => {
  it("굴리고 연출이 끝난 뒤 초이스를 골라 기록하면 다섯 눈의 합이 적힌다", () => {
    const store = storeWith([[3, 4, 5, 6, 6]]);

    expect(store.getState().roll()).toEqual({ ok: true });
    finishPresentation(store);
    expect(store.getState().select("choice")).toEqual({ ok: true });
    expect(store.getState().record()).toEqual({ ok: true });

    expect(store.getState().game.players[0]?.scores.choice).toBe(24);
    expect(store.getState().selection).toBeNull();
  });

  it("굴림 결과는 굴림 버튼을 누른 순간 정해져 있다", () => {
    const store = storeWith([[1, 2, 3, 4, 5]]);

    store.getState().roll();

    expect(store.getState().presentation.phase).toBe("rolling");
    expect(store.getState().game.dice.map((d) => d.value)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("조작 잠금", () => {
  it("첫 굴림 전에는 카테고리를 고를 수 없고 기록도 할 수 없다", () => {
    const store = storeWith([]);

    expect(store.getState().permissions().canSelect("choice")).toBe(false);
    expect(store.getState().select("choice")).toEqual({ ok: false, reason: "not-rolled-yet" });
    expect(store.getState().record()).toEqual({ ok: false, reason: "no-selection" });
  });

  it("굴림 버튼을 누른 때부터 정렬 끝까지 굴림·홀드·기록·선택이 모두 막힌다", () => {
    const store = storeWith([
      [1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2],
    ]);
    store.getState().roll();

    for (const phase of ["rolling", "stopped"] as const) {
      expect(store.getState().presentation.phase).toBe(phase);
      const can = store.getState().permissions();
      expect([can.canRoll, can.canHold(0), can.canRecord, can.canSelect("choice")]).toEqual([
        false,
        false,
        false,
        false,
      ]);
      expect(store.getState().roll()).toEqual({ ok: false, reason: "presenting" });
      expect(store.getState().select("choice")).toEqual({ ok: false, reason: "presenting" });
      if (phase === "rolling") {
        const { presentation } = store.getState();
        if (presentation.phase !== "idle") store.getState().presenterStopped(presentation.rollId);
      }
    }
    // 막혀 있는 동안 굴림 명령이 엔진에 가지 않았다: 두 번째 굴림 결과가 쓰이지 않았다.
    expect(store.getState().game.rollsUsed).toBe(1);

    const { presentation } = store.getState();
    if (presentation.phase !== "idle") store.getState().presenterLinedUp(presentation.rollId);
    const can = store.getState().permissions();
    expect([can.canRoll, can.canSelect("choice")]).toEqual([true, true]);
  });

  it("굴림 버튼을 누르면 선택이 지워진다", () => {
    const store = storeWith([
      [1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2],
    ]);
    store.getState().roll();
    finishPresentation(store);
    store.getState().select("choice");

    store.getState().roll();

    expect(store.getState().selection).toBeNull();
  });

  it("지난 굴림의 늦은 알림은 지금 연출의 잠금을 풀지 않는다", () => {
    const store = storeWith([
      [1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2],
    ]);
    store.getState().roll();
    const first = store.getState().presentation;
    finishPresentation(store);
    store.getState().roll();

    if (first.phase !== "idle") store.getState().presenterLinedUp(first.rollId);

    expect(store.getState().presentation.phase).toBe("rolling");
  });
});

describe("홀드", () => {
  /** 화면 순서(홀드 자리 → 정렬 줄, 각각 왼쪽 열부터)로 읽은 [눈, 줄]. */
  const view = (store: ReturnType<typeof storeWith>) => {
    const { game } = store.getState();
    const slots = store.getState().slots();
    return [...slots]
      .sort((a, b) => (a.row === b.row ? a.column - b.column : a.row === "hold" ? -1 : 1))
      .map((s) => `${game.dice[s.id]?.value}${s.row === "hold" ? "↑" : ""}`)
      .join(" ");
  };

  it("정렬이 끝난 뒤 홀드하면 그 주사위만 같은 열의 홀드 자리로 가고, 다른 주사위는 제자리다", () => {
    const store = storeWith([[5, 1, 4, 1, 3]]);
    store.getState().roll();
    finishPresentation(store);
    const before = store.getState().slots();

    expect(store.getState().toggleHold(4)).toEqual({ ok: true });

    const after = store.getState().slots();
    expect(after[4]).toEqual({ ...before[4], row: "hold" });
    expect(after.filter((_, id) => id !== 4)).toEqual(before.filter((_, id) => id !== 4));
  });

  it("연달아 두 주사위를 홀드하면 둘 다 홀드되고, 다시 누르면 같은 열의 정렬 줄로 내려온다", () => {
    const store = storeWith([[5, 1, 4, 1, 3]]);
    store.getState().roll();
    finishPresentation(store);
    expect(view(store)).toBe("1 1 3 4 5");

    store.getState().toggleHold(0);
    store.getState().toggleHold(2);
    settleMoves(store);
    expect(store.getState().game.dice.map((d) => d.held)).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
    expect(store.getState().slots()[0]).toEqual({ id: 0, column: 4, row: "hold" });

    store.getState().toggleHold(0);
    expect(store.getState().slots()[0]).toEqual({ id: 0, column: 4, row: "lineup" });
  });

  it("다시 굴리면 홀드 자리는 왼쪽 열부터, 다시 굴린 주사위는 그 오른쪽 열부터 각각 오름차순이다", () => {
    const store = storeWith([
      [6, 1, 6, 2, 3],
      [4, 1, 5],
    ]);
    store.getState().roll();
    finishPresentation(store);
    store.getState().toggleHold(2);
    store.getState().toggleHold(0);
    settleMoves(store);

    store.getState().roll();
    finishPresentation(store);

    expect(view(store)).toBe("6↑ 6↑ 1 4 5");
  });

  it("3번째 굴림이 끝나면 다섯 개가 모두 홀드 자리에 오름차순으로 모이지만, 엔진의 홀드는 그대로다", () => {
    const store = storeWith([
      [5, 3, 6, 4, 5],
      [3, 4],
      [1, 2],
    ]);
    store.getState().roll();
    finishPresentation(store);
    for (const id of [0, 2, 4] as const) store.getState().toggleHold(id);
    settleMoves(store);
    store.getState().roll();
    finishPresentation(store);

    store.getState().roll();
    // 연출 입구는 굴림 동안 엔진의 홀드 그대로 받는다(홀드한 것만 컵에 넣지 않는다).
    expect(
      store
        .getState()
        .slots()
        .map((s) => s.row),
    ).toEqual(["hold", "lineup", "hold", "lineup", "hold"]);
    finishPresentation(store);
    settleMoves(store);

    expect(view(store)).toBe("1↑ 2↑ 5↑ 5↑ 6↑");
    expect(store.getState().game.dice.map((d) => d.held)).toEqual([true, false, true, false, true]);
    expect(store.getState().permissions().canHold(1)).toBe(false);
    expect(store.getState().toggleHold(1)).toEqual({ ok: false, reason: "no-rolls-left" });
  });

  it("굴림 연출 중과 첫 굴림 전에는 홀드가 거부된다", () => {
    const store = storeWith([[1, 2, 3, 4, 5]]);
    expect(store.getState().toggleHold(0)).toEqual({ ok: false, reason: "not-rolled-yet" });

    store.getState().roll();

    expect(store.getState().toggleHold(0)).toEqual({ ok: false, reason: "presenting" });
    expect(store.getState().game.dice[0]?.held).toBe(false);
  });

  it("다섯 개를 모두 홀드하면 굴림 버튼이 막힌다", () => {
    const store = storeWith([[1, 2, 3, 4, 5]]);
    store.getState().roll();
    finishPresentation(store);

    for (const id of [0, 1, 2, 3, 4] as const) store.getState().toggleHold(id);
    settleMoves(store);

    expect(store.getState().permissions().canRoll).toBe(false);
    expect(store.getState().roll()).toEqual({ ok: false, reason: "all-held" });
  });
});

describe("점수 미리보기가 보이는 때", () => {
  it("굴러가는 동안에는 숨고, 멈춤부터 보인다", () => {
    const store = storeWith([[1, 1, 1, 1, 1]]);
    expect(store.getState().previewVisible()).toBe(false);

    store.getState().roll();
    expect(store.getState().previewVisible()).toBe(false);

    const { presentation } = store.getState();
    if (presentation.phase !== "idle") store.getState().presenterStopped(presentation.rollId);
    expect(store.getState().previewVisible()).toBe(true);
  });
});

describe("홀드 이동 중 잠금", () => {
  it("주사위 A가 옮겨 가는 동안 B의 홀드는 받고, A의 홀드·굴림·기록은 거부한다(카테고리 선택은 된다)", () => {
    const store = storeWith([[5, 1, 4, 1, 3]]);
    store.getState().roll();
    finishPresentation(store);
    store.getState().select("choice");

    expect(store.getState().toggleHold(0)).toEqual({ ok: true });

    expect(store.getState().toggleHold(2)).toEqual({ ok: true });
    expect(store.getState().toggleHold(0)).toEqual({ ok: false, reason: "moving" });
    expect(store.getState().roll()).toEqual({ ok: false, reason: "moving" });
    expect(store.getState().record()).toEqual({ ok: false, reason: "moving" });
    expect(store.getState().select("yacht")).toEqual({ ok: true });
    const can = store.getState().permissions();
    expect([can.canHold(0), can.canHold(2), can.canHold(1), can.canRoll, can.canRecord]).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(store.getState().game.dice.map((d) => d.held)).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
  });

  it("A가 다 옮겨지면 A를 다시 누를 수 있고, 옮겨 가는 주사위가 없어야 굴림·기록이 된다", () => {
    const store = storeWith([
      [5, 1, 4, 1, 3],
      [2, 2, 2],
    ]);
    store.getState().roll();
    finishPresentation(store);
    store.getState().toggleHold(0);
    store.getState().toggleHold(2);

    store.getState().presenterDieSettled(0);

    expect(store.getState().permissions().canHold(0)).toBe(true);
    expect(store.getState().roll()).toEqual({ ok: false, reason: "moving" });

    store.getState().presenterDieSettled(2);

    expect(store.getState().roll()).toEqual({ ok: true });
  });

  it("옮겨 가지 않는 주사위의 다 옮겼다는 알림은 아무것도 바꾸지 않는다", () => {
    const store = storeWith([[5, 1, 4, 1, 3]]);
    store.getState().roll();
    finishPresentation(store);
    store.getState().toggleHold(0);

    store.getState().presenterDieSettled(3);

    expect(store.getState().movingDice).toEqual([0]);
  });
});

describe("3번째 굴림 뒤 자동 이동 중 잠금", () => {
  /** 첫 굴림 뒤 주사위 0을 홀드하고 두 번 더 굴려 3번째 굴림의 정렬 끝까지 알린다. */
  function afterThirdLineup() {
    const store = storeWith([
      [6, 1, 2, 3, 4],
      [1, 2, 3, 4],
      [5, 5, 5, 5],
    ]);
    store.getState().roll();
    finishPresentation(store);
    store.getState().toggleHold(0);
    settleMoves(store);
    store.getState().roll();
    finishPresentation(store);
    store.getState().roll();
    finishPresentation(store);
    return store;
  }

  it("정렬 줄의 주사위가 홀드 자리로 올라가는 동안 굴림·홀드·카테고리 선택·기록을 모두 거부한다", () => {
    const store = afterThirdLineup();

    expect(store.getState().presentation.phase).toBe("auto-moving");
    expect(
      store
        .getState()
        .slots()
        .every((s) => s.row === "hold"),
    ).toBe(true);
    const can = store.getState().permissions();
    expect([can.canRoll, can.canHold(0), can.canHold(1), can.canSelect("yacht")]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(store.getState().select("yacht")).toEqual({ ok: false, reason: "presenting" });
    expect(store.getState().toggleHold(1)).toEqual({ ok: false, reason: "presenting" });
    expect(store.getState().previewVisible()).toBe(true);
  });

  it("올라간 주사위를 모두 다 옮겼다고 알리면 카테고리를 골라 기록할 수 있다", () => {
    const store = afterThirdLineup();

    for (const die of [1, 2, 3] as const) store.getState().presenterDieSettled(die);
    expect(store.getState().permissions().canSelect("yacht")).toBe(false);
    store.getState().presenterDieSettled(4);

    expect(store.getState().presentation.phase).toBe("idle");
    expect(
      store
        .getState()
        .slots()
        .every((s) => s.row === "hold"),
    ).toBe(true);
    expect(store.getState().toggleHold(1)).toEqual({ ok: false, reason: "no-rolls-left" });
    expect(store.getState().select("yacht")).toEqual({ ok: true });
    expect(store.getState().record()).toEqual({ ok: true });
    expect(store.getState().game.players[0]?.scores.yacht).toBe(0);
  });
});

describe("'동작 줄이기'가 켜져 있으면 옮겨 가는 이동이 없다", () => {
  function reducedStore(rolls: DieValue[][]) {
    return createGameStore({
      players: ["플레이어 1"],
      diceSource: scriptedDiceSource(rolls),
      reducedMotion: true,
    });
  }

  it("홀드한 바로 뒤에 굴릴 수 있다", () => {
    const store = reducedStore([
      [5, 1, 4, 1, 3],
      [2, 2, 2, 2],
    ]);
    store.getState().roll();
    finishPresentation(store);

    store.getState().toggleHold(0);

    expect(store.getState().roll()).toEqual({ ok: true });
  });

  it("3번째 굴림의 정렬 끝에 바로 모든 조작이 풀린다", () => {
    const store = reducedStore([
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
    ]);
    for (let i = 0; i < 3; i++) {
      store.getState().roll();
      finishPresentation(store);
    }

    expect(store.getState().presentation.phase).toBe("idle");
    expect(
      store
        .getState()
        .slots()
        .every((s) => s.row === "hold"),
    ).toBe(true);
    expect(store.getState().select("choice")).toEqual({ ok: true });
  });

  it("옮겨 가는 도중에 켜지면 순간 배치로 바뀌므로 잠금이 풀린다", () => {
    const store = storeWith([
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
    ]);
    store.getState().roll();
    finishPresentation(store);
    store.getState().toggleHold(0);

    store.getState().setReducedMotion(true);

    expect(store.getState().permissions().canRoll).toBe(true);
    store.getState().roll();
    finishPresentation(store);
    store.getState().setReducedMotion(false);
    store.getState().roll();
    finishPresentation(store);
    expect(store.getState().presentation.phase).toBe("auto-moving");

    store.getState().setReducedMotion(true);

    expect(store.getState().presentation.phase).toBe("idle");
    expect(store.getState().permissions().canSelect("choice")).toBe(true);
  });
});
