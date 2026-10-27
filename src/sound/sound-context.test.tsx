// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { scriptedDiceSource } from "../engine/dice-source";
import { createGameStore } from "../store/game-store";
import { GameStoreProvider } from "../store/store-context";
import type { RollSound, Sound } from "./sound";
import { SoundProvider, useRollSound } from "./sound-context";

afterEach(cleanup);

function setup(reducedMotion: boolean) {
  const played: string[] = [];
  const sound: Sound = {
    unlock() {},
    setMuted() {},
    shake: () => {
      played.push("shake");
      return { stop() {} };
    },
    hits: () => {
      played.push("hits");
      return { stop() {} };
    },
  };
  const store = createGameStore({
    players: ["가"],
    diceSource: scriptedDiceSource([]),
    reducedMotion,
  });
  let roll: RollSound | null = null;
  function Probe() {
    roll = useRollSound();
    return null;
  }
  render(
    <GameStoreProvider store={store}>
      <SoundProvider sound={sound}>
        <Probe />
      </SoundProvider>
    </GameStoreProvider>,
  );
  const play = () => {
    roll?.shake(0);
    roll?.hits([{ delay: 0, gain: 1 }]);
  };
  return { played, play, store };
}

describe("굴림 연출의 소리", () => {
  it("굴림 연출은 컵 흔드는 소리와 충돌음을 낸다", () => {
    const { played, play } = setup(false);
    play();
    expect(played).toEqual(["shake", "hits"]);
  });

  it("'동작 줄이기'가 켜져 있으면 굴러가는 소리 없이 진행된다", () => {
    const { played, play, store } = setup(true);
    play();
    expect(played).toEqual([]);
    act(() => store.getState().setReducedMotion(false));
    play();
    expect(played).toEqual(["shake", "hits"]);
  });
});
