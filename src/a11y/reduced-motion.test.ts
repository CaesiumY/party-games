import { describe, expect, it } from "vitest";
import { scriptedDiceSource } from "../engine/dice-source";
import { createGameStore } from "../store/game-store";
import { type MotionQuery, syncReducedMotion } from "./reduced-motion";

function fakeQuery(initial: boolean) {
  const listeners = new Set<() => void>();
  const query: MotionQuery & { flip(on: boolean): void } = {
    matches: initial,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    flip(on) {
      query.matches = on;
      for (const l of listeners) l();
    },
  };
  return query;
}

describe("'동작 줄이기' 설정", () => {
  it("기기 설정을 저장소에 두고, 설정이 바뀌면 따라 바뀐다", () => {
    const store = createGameStore({ players: ["플레이어 1"], diceSource: scriptedDiceSource([]) });
    const query = fakeQuery(true);

    const stop = syncReducedMotion(query, store.getState().setReducedMotion);
    expect(store.getState().reducedMotion).toBe(true);

    query.flip(false);
    expect(store.getState().reducedMotion).toBe(false);

    stop();
    query.flip(true);
    expect(store.getState().reducedMotion).toBe(false);
  });
});
