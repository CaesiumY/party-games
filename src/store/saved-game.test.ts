import { describe, expect, it } from "vitest";
import { scriptedDiceSource } from "../engine/dice-source";
import { record, roll, startGame, toggleHold } from "../engine/game";
import type { CommandResult, GameState } from "../engine/types";
import { savedGameValue } from "./saved-game";
import { memoryStorage } from "./stored-value";

function ok(result: CommandResult): GameState {
  if (!result.ok) throw new Error(`거부됨: ${result.reason}`);
  return result.state;
}

/** 둘째 플레이어가 한 번 굴리고 주사위 하나를 홀드한 게임. */
function midGame(): GameState {
  const source = scriptedDiceSource([
    [2, 3, 4, 5, 6],
    [6, 6, 5, 5, 4],
  ]);
  const first = ok(record(ok(roll(startGame(["가", "나"]), source)), "choice"));
  return ok(toggleHold(ok(roll(first, source)), 3));
}

/** 저장 형식(`{version, value}`)을 그대로 써 넣는다. */
function writeRaw(storage: ReturnType<typeof memoryStorage>, value: unknown, version = 1) {
  storage.setItem("yacht.saved-game", JSON.stringify({ version, value }));
}

describe("진행 중 게임 저장 항목", () => {
  it("저장한 게임을 그대로 읽는다", () => {
    const storage = memoryStorage();
    savedGameValue(storage).write(midGame());

    expect(savedGameValue(storage).read()).toEqual(midGame());
  });

  it("끝난 게임은 이어 할 수 없어 읽지 않고 버린다", () => {
    const storage = memoryStorage();
    writeRaw(storage, { ...midGame(), finished: true });

    expect(savedGameValue(storage).read()).toBeNull();
    expect(storage.getItem("yacht.saved-game")).toBeNull();
  });

  it("버전이 다르면 이 항목만 버린다", () => {
    const storage = memoryStorage();
    writeRaw(storage, midGame(), 0);
    storage.setItem("yacht.best-score", JSON.stringify({ version: 1, value: 120 }));

    expect(savedGameValue(storage).read()).toBeNull();
    expect(storage.getItem("yacht.saved-game")).toBeNull();
    expect(storage.getItem("yacht.best-score")).not.toBeNull();
  });

  const game = midGame();
  const broken: [string, unknown][] = [
    ["객체가 아님", "게임"],
    ["플레이어가 없음", { ...game, players: [] }],
    ["플레이어가 다섯 명", { ...game, players: [...game.players, ...game.players, game.players[0]] }],
    ["이름이 글자가 아님", { ...game, players: [{ name: 1, scores: {} }, game.players[1]] }],
    ["모르는 카테고리", { ...game, players: [{ name: "가", scores: { bonus: 35 } }, game.players[1]] }],
    ["점수가 정수가 아님", { ...game, players: [{ name: "가", scores: { choice: 1.5 } }, game.players[1]] }],
    ["점수가 음수", { ...game, players: [{ name: "가", scores: { choice: -1 } }, game.players[1]] }],
    ["지금 차례가 인원 밖", { ...game, currentPlayer: 2 }],
    ["턴이 13", { ...game, turn: 13 }],
    ["턴이 0", { ...game, turn: 0 }],
    ["굴림 횟수가 4", { ...game, rollsUsed: 4 }],
    ["주사위가 네 개", { ...game, dice: game.dice.slice(0, 4) }],
    ["주사위 번호가 자리와 다름", { ...game, dice: [...game.dice].reverse() }],
    ["눈이 7", { ...game, dice: game.dice.map((d) => (d.id === 0 ? { ...d, value: 7 } : d)) }],
    ["홀드가 참거짓이 아님", { ...game, dice: game.dice.map((d) => ({ ...d, held: "예" })) }],
    ["끝남 표시가 없음", { ...game, finished: undefined }],
  ];
  it.each(broken)("읽을 수 없는 게임(%s)은 버린다", (_, value) => {
    const storage = memoryStorage();
    writeRaw(storage, value);

    expect(savedGameValue(storage).read()).toBeNull();
    expect(storage.getItem("yacht.saved-game")).toBeNull();
  });
});
