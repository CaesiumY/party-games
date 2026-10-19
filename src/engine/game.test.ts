import { describe, expect, it } from "vitest";
import { type DiceSource, type RollRequest, scriptedDiceSource } from "./dice-source";
import { record, roll, rollsLeft, startGame, toggleHold } from "./game";
import type { CommandResult, GameState } from "./types";

function ok(result: CommandResult): GameState {
  if (!result.ok) throw new Error(`거부됨: ${result.reason}`);
  return result.state;
}

describe("첫 굴림과 초이스 기록", () => {
  it("첫 굴림 뒤 초이스에 다섯 눈의 합이 기록된다", () => {
    const source = scriptedDiceSource([[3, 4, 5, 6, 6]]);
    const game = startGame(["플레이어 1"]);

    const rolled = ok(roll(game, source));
    const recorded = ok(record(rolled, "choice"));

    expect(recorded.players[0]?.scores.choice).toBe(24);
  });

  it("턴의 첫 굴림 전에는 기록이 거부된다", () => {
    const game = startGame(["플레이어 1"]);

    expect(record(game, "choice")).toEqual({ ok: false, reason: "not-rolled-yet" });
  });

  it("기록하면 다음 턴으로 넘어가고, 그 턴도 첫 굴림 전에는 기록할 수 없다", () => {
    const game = startGame(["플레이어 1"]);
    const rolled = ok(roll(game, scriptedDiceSource([[1, 1, 1, 1, 1]])));

    const next = ok(record(rolled, "choice"));

    expect(next.turn).toBe(2);
    expect(record(next, "choice")).toEqual({ ok: false, reason: "not-rolled-yet" });
  });

  it("이미 기록한 카테고리에 다시 기록하면 거부된다", () => {
    const source = scriptedDiceSource([
      [1, 1, 1, 1, 1],
      [6, 6, 6, 6, 6],
    ]);
    const turn1 = ok(record(ok(roll(startGame(["플레이어 1"]), source)), "choice"));
    const turn2 = ok(roll(turn1, source));

    expect(record(turn2, "choice")).toEqual({ ok: false, reason: "category-filled" });
  });

  // #6 에서 12개 카테고리가 다 들어오면 이 테스트는 지운다.
  it("점수 계산이 아직 들어오지 않은 카테고리에는 기록할 수 없다", () => {
    const rolled = ok(roll(startGame(["플레이어 1"]), scriptedDiceSource([[1, 2, 3, 4, 5]])));

    expect(record(rolled, "yacht")).toEqual({ ok: false, reason: "category-unavailable" });
  });
});

describe("굴림 횟수", () => {
  it("한 턴에 세 번까지 굴리고, 남은 굴림이 하나씩 줄며, 네 번째 굴림은 거부된다", () => {
    const source = scriptedDiceSource([
      [1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2],
      [3, 3, 3, 3, 3],
    ]);
    const game = startGame(["플레이어 1"]);
    expect(rollsLeft(game)).toBe(3);

    const first = ok(roll(game, source));
    const second = ok(roll(first, source));
    const third = ok(roll(second, source));

    expect([rollsLeft(first), rollsLeft(second), rollsLeft(third)]).toEqual([2, 1, 0]);
    expect(roll(third, source)).toEqual({ ok: false, reason: "no-rolls-left" });
  });
});

describe("주사위 공급원", () => {
  it("공급원은 플레이어·턴·굴림 번호·굴릴 개수를 받는다", () => {
    const requests: RollRequest[] = [];
    const source: DiceSource = (request) => {
      requests.push(request);
      return [2, 2, 2, 2, 2];
    };
    const game = startGame(["플레이어 1", "플레이어 2"]);

    const first = ok(roll(game, source));
    const second = ok(roll(first, source));
    const nextPlayer = ok(roll(ok(record(second, "choice")), source));

    expect(nextPlayer.currentPlayer).toBe(1);
    expect(requests).toEqual([
      { player: 0, turn: 1, rollNumber: 1, count: 5 },
      { player: 0, turn: 1, rollNumber: 2, count: 5 },
      { player: 1, turn: 1, rollNumber: 1, count: 5 },
    ]);
  });
});

describe("저장과 복원", () => {
  it("게임 도중 상태를 JSON 으로 저장했다 복원하면 같은 상태이고, 이어서 진행한 결과도 같다", () => {
    const script = [
      [2, 3, 4, 5, 6],
      [6, 6, 5, 5, 4],
      [1, 2, 1, 2, 1],
    ] as const;
    const midGame = ok(roll(startGame(["플레이어 1", "플레이어 2"]), scriptedDiceSource(script)));

    const restored: GameState = JSON.parse(JSON.stringify(midGame));
    expect(restored).toEqual(midGame);

    const continueFrom = (state: GameState) => {
      const source = scriptedDiceSource(script.slice(1));
      const afterRecord = ok(record(state, "choice"));
      return ok(record(ok(roll(afterRecord, source)), "choice"));
    };
    expect(continueFrom(restored)).toEqual(continueFrom(midGame));
    expect(continueFrom(restored).players.map((p) => p.scores.choice)).toEqual([20, 26]);
  });
});

describe("주사위 정체성", () => {
  it("굴림 결과는 주사위 순서대로 들어가고, 엔진은 눈 순서로 다시 늘어놓지 않는다", () => {
    const game = startGame(["플레이어 1"]);

    const rolled = ok(roll(game, scriptedDiceSource([[6, 5, 4, 3, 2]])));

    expect(rolled.dice.map((die) => [die.id, die.value])).toEqual([
      [0, 6],
      [1, 5],
      [2, 4],
      [3, 3],
      [4, 2],
    ]);
  });
});

describe("홀드", () => {
  const firstRoll = () =>
    ok(roll(startGame(["플레이어 1"]), scriptedDiceSource([[2, 3, 4, 5, 6]])));

  it("홀드를 토글하면 그 주사위만 홀드되고, 다시 토글하면 풀린다", () => {
    const held = ok(toggleHold(firstRoll(), 2));

    expect(held.dice.map((die) => die.held)).toEqual([false, false, true, false, false]);
    expect(ok(toggleHold(held, 2)).dice.every((die) => !die.held)).toBe(true);
  });

  it("홀드를 바꿔도 주사위 정체성과 눈은 그대로다", () => {
    const held = ok(toggleHold(ok(toggleHold(firstRoll(), 4)), 0));

    expect(held.dice.map((die) => [die.id, die.value])).toEqual([
      [0, 2],
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 6],
    ]);
  });

  it("턴의 첫 굴림 전에는 홀드가 거부된다", () => {
    expect(toggleHold(startGame(["플레이어 1"]), 0)).toEqual({
      ok: false,
      reason: "not-rolled-yet",
    });
  });

  it("홀드한 주사위는 다시 굴려도 눈이 그대로이고, 홀드하지 않은 주사위만 굴린다", () => {
    const counts: number[] = [];
    const script = scriptedDiceSource([
      [1, 2, 3, 4, 5],
      [6, 6, 6],
    ]);
    const source: DiceSource = (request) => {
      counts.push(request.count);
      return script(request);
    };
    const first = ok(roll(startGame(["플레이어 1"]), source));
    const held = ok(toggleHold(ok(toggleHold(first, 1)), 3));

    const second = ok(roll(held, source));

    expect(counts).toEqual([5, 3]);
    expect(second.dice.map((die) => die.value)).toEqual([6, 2, 6, 4, 6]);
    expect(second.dice.map((die) => die.held)).toEqual([false, true, false, true, false]);
  });

  it("다섯 개를 모두 홀드하면 굴릴 수 없고, 하나를 풀면 다시 굴릴 수 있다", () => {
    let state = firstRoll();
    for (const id of [0, 1, 2, 3, 4] as const) state = ok(toggleHold(state, id));

    expect(roll(state, scriptedDiceSource([]))).toEqual({ ok: false, reason: "all-held" });
    expect(roll(ok(toggleHold(state, 0)), scriptedDiceSource([[1]])).ok).toBe(true);
  });

  it("세 번 다 굴린 뒤에는 홀드할 수 없다", () => {
    const source = scriptedDiceSource([
      [1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2],
      [3, 3, 3, 3, 3],
    ]);
    const third = ok(roll(ok(roll(ok(roll(startGame(["플레이어 1"]), source)), source)), source));

    expect(toggleHold(third, 0)).toEqual({ ok: false, reason: "no-rolls-left" });
  });

  it("기록해서 새 턴이 되면 홀드가 모두 풀린다", () => {
    const held = ok(toggleHold(ok(toggleHold(firstRoll(), 0)), 4));

    const next = ok(record(held, "choice"));

    expect(next.dice.every((die) => !die.held)).toBe(true);
  });
});
