// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app";
import { scriptedDiceSource } from "../engine/dice-source";
import type { Sound } from "../sound/sound";
import { createGameStore } from "../store/game-store";
import { mutedValue } from "../store/muted";
import { memoryStorage } from "../store/stored-value";

afterEach(cleanup);

/** 부른 명령을 적어 두는 효과음 대역. 소리는 내지 않는다. */
function recordingSound() {
  const calls: string[] = [];
  const sound: Sound = {
    unlock: () => calls.push("unlock"),
    setMuted: (on) => calls.push(on ? "mute" : "unmute"),
    shake: () => ({ stop() {} }),
    hits: () => ({ stop() {} }),
  };
  return { sound, calls };
}

function renderWithSound(storage = memoryStorage()) {
  const store = createGameStore({
    players: ["플레이어 1"],
    diceSource: scriptedDiceSource([[1, 2, 3, 4, 5]]),
    muted: mutedValue(storage),
  });
  const { sound, calls } = recordingSound();
  render(<App store={store} webgl sound={sound} Board={() => <div className="board" />} />);
  return { store, calls };
}

const muteButton = () => screen.getByRole("button", { name: "음소거" });

describe("효과음과 음소거", () => {
  it("음소거 버튼으로 소리를 끄고 켠다", async () => {
    const user = userEvent.setup();
    const { store, calls } = renderWithSound();
    expect(muteButton().getAttribute("aria-pressed")).toBe("false");
    expect(calls).toEqual(["unmute"]);

    await user.click(muteButton());
    expect(muteButton().getAttribute("aria-pressed")).toBe("true");
    expect(store.getState().muted).toBe(true);
    expect(calls.at(-1)).toBe("mute");

    await user.click(muteButton());
    expect(muteButton().getAttribute("aria-pressed")).toBe("false");
    expect(calls.at(-1)).toBe("unmute");
  });

  it("지난 방문에 꺼 두었으면 처음부터 꺼진 채로 연다", () => {
    const storage = memoryStorage();
    mutedValue(storage).write(true);
    const { calls } = renderWithSound(storage);
    expect(muteButton().getAttribute("aria-pressed")).toBe("true");
    expect(calls).toEqual(["mute"]);
  });

  it("오디오는 첫 굴림 탭에서 풀린다. 그 전에는 풀지 않는다", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithSound();
    await user.click(muteButton());
    expect(calls).not.toContain("unlock");
    await user.click(screen.getByRole("button", { name: "주사위 던지기" }));
    expect(calls).toContain("unlock");
  });

  it("음소거 버튼은 판 위에 겹쳐 카메라가 피해 가는 표시를 단다", () => {
    renderWithSound();
    expect(muteButton().closest("[data-board-overlay]")).not.toBeNull();
  });
});
