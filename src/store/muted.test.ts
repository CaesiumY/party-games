import { describe, expect, it } from "vitest";
import { scriptedDiceSource } from "../engine/dice-source";
import { bestScoreValue } from "./best-score";
import { createGameStore } from "./game-store";
import { mutedValue } from "./muted";
import { type KeyValueStorage, memoryStorage } from "./stored-value";

function storeOn(storage: KeyValueStorage) {
  return createGameStore({
    players: ["플레이어 1"],
    diceSource: scriptedDiceSource([]),
    muted: mutedValue(storage),
  });
}

describe("음소거 설정", () => {
  it("처음 오면 소리가 켜져 있다", () => {
    expect(storeOn(memoryStorage()).getState().muted).toBe(false);
  });

  it("음소거 버튼으로 끄고 켜며, 그 설정은 다음 방문(같은 저장소로 새로 연 앱)에도 남는다", () => {
    const storage = memoryStorage();
    storeOn(storage).getState().toggleMuted();
    const revisit = storeOn(storage);
    expect(revisit.getState().muted).toBe(true);
    revisit.getState().toggleMuted();
    expect(revisit.getState().muted).toBe(false);
    expect(storeOn(storage).getState().muted).toBe(false);
  });

  it("새 게임을 열어도 음소거는 그대로다", () => {
    const store = storeOn(memoryStorage());
    store.getState().toggleMuted();
    store.getState().restart();
    store.getState().goHome();
    store.getState().newGame(["가", "나"]);
    expect(store.getState().muted).toBe(true);
  });

  it("음소거 항목의 형식이 맞지 않으면 그 항목만 버리고, 최고 점수는 그대로 둔다", () => {
    const storage = memoryStorage();
    bestScoreValue(storage).write(120);
    storage.setItem("yacht.muted", JSON.stringify({ version: 1, value: "yes" }));
    expect(storeOn(storage).getState().muted).toBe(false);
    expect(storage.getItem("yacht.muted")).toBeNull();
    expect(bestScoreValue(storage).read()).toBe(120);
  });

  it("저장 항목을 주지 않으면 저장하지 않고 이번 방문 동안만 기억한다", () => {
    const store = createGameStore({ players: ["가"], diceSource: scriptedDiceSource([]) });
    store.getState().toggleMuted();
    expect(store.getState().muted).toBe(true);
  });
});
