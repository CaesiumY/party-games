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
