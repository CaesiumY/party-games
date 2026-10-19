import { describe, expect, it } from "vitest";
import { type DiceSource, type RollRequest, scriptedDiceSource } from "./dice-source";
import {
  comboCallout,
  contributingDice,
  record,
  roll,
  rollsLeft,
  scorePreview,
  startGame,
  toggleHold,
} from "./game";
import { totalScore, upperSubtotal } from "./totals";
import {
  CATEGORIES,
  type Category,
  type CommandResult,
  type DieValue,
  type GameState,
} from "./types";

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
});

describe("점수 미리보기와 기록", () => {
  it("12개 카테고리 모두 점수 미리보기 값이 그대로 기록된다", () => {
    const rolled = ok(roll(startGame(["플레이어 1"]), scriptedDiceSource([[1, 1, 2, 3, 4]])));
    const expected: Record<Category, number> = {
      aces: 2,
      deuces: 2,
      treys: 3,
      fours: 4,
      fives: 0,
      sixes: 0,
      choice: 11,
      fourDice: 0,
      fullHouse: 0,
      sStraight: 15,
      lStraight: 0,
      yacht: 0,
    };

    for (const category of CATEGORIES) {
      const preview = scorePreview(rolled, category);
      const recorded = ok(record(rolled, category)).players[0]?.scores[category];

      expect([category, preview]).toEqual([category, expected[category]]);
      expect([category, recorded]).toEqual([category, preview]);
    }
  });

  it("첫 굴림 뒤에는 남은 굴림이 있어도 언제든 기록할 수 있다", () => {
    const rolled = ok(roll(startGame(["플레이어 1"]), scriptedDiceSource([[2, 2, 2, 2, 2]])));
    expect(rollsLeft(rolled)).toBe(2);

    const recorded = ok(record(rolled, "yacht"));

    expect(recorded.players[0]?.scores.yacht).toBe(50);
  });

  it("성립하지 않는 카테고리에 기록하면 0점(스크래치)이 적힌다", () => {
    const rolled = ok(roll(startGame(["플레이어 1"]), scriptedDiceSource([[1, 2, 3, 5, 6]])));

    const recorded = ok(record(rolled, "lStraight"));

    expect(recorded.players[0]?.scores).toEqual({ lStraight: 0 });
  });
});

describe("최대 점수 한 판", () => {
  it("정해진 눈으로 12턴을 진행하면 총합 득점 325점이 나온다", () => {
    const turns: [Category, DieValue[]][] = [
      ["aces", [1, 1, 1, 1, 1]],
      ["deuces", [2, 2, 2, 2, 2]],
      ["treys", [3, 3, 3, 3, 3]],
      ["fours", [4, 4, 4, 4, 4]],
      ["fives", [5, 5, 5, 5, 5]],
      ["sixes", [6, 6, 6, 6, 6]],
      ["choice", [6, 6, 6, 6, 6]],
      ["fourDice", [6, 6, 6, 6, 6]],
      ["fullHouse", [6, 6, 6, 6, 6]],
      ["sStraight", [1, 2, 3, 4, 5]],
      ["lStraight", [2, 3, 4, 5, 6]],
      ["yacht", [6, 6, 6, 6, 6]],
    ];
    const source = scriptedDiceSource(turns.map(([, values]) => values));

    let state = startGame(["플레이어 1"]);
    for (const [category] of turns) state = ok(record(ok(roll(state, source)), category));

    const player = state.players[0];
    if (!player) throw new Error("플레이어가 없다");
    expect(upperSubtotal(player)).toBe(105);
    expect(totalScore(player)).toBe(325);
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

describe("기여 주사위와 성립 알림", () => {
  const rolled = (values: DieValue[]) =>
    ok(roll(startGame(["플레이어 1"]), scriptedDiceSource([values])));

  it("기여 주사위는 주사위 정체성(DieId)으로 알려 준다. 홀드해도 같은 주사위다", () => {
    const held = ok(toggleHold(rolled([3, 1, 6, 1, 2]), 3));

    expect(contributingDice(held, "aces")).toEqual([1, 3]);
  });

  it("성립 알림: 요트가 나오면 요트", () => {
    expect(comboCallout(rolled([5, 5, 5, 5, 5]))).toBe("yacht");
  });

  it("성립 알림: 12345 는 S. 스트레이트도 성립하지만 L. 스트레이트만 띄운다", () => {
    expect(comboCallout(rolled([3, 1, 5, 2, 4]))).toBe("lStraight");
  });

  it("성립 알림: 포 다이스·풀 하우스·S. 스트레이트는 각각 그 이름을 띄운다", () => {
    expect(comboCallout(rolled([2, 2, 1, 2, 2]))).toBe("fourDice");
    expect(comboCallout(rolled([1, 6, 1, 6, 1]))).toBe("fullHouse");
    expect(comboCallout(rolled([1, 1, 2, 3, 4]))).toBe("sStraight");
  });

  it("성립 알림: 아랫칸 카테고리가 아무것도 성립하지 않으면 없다(초이스는 띄우지 않는다)", () => {
    expect(comboCallout(rolled([1, 2, 3, 5, 6]))).toBeNull();
    expect(comboCallout(rolled([6, 6, 6, 5, 4]))).toBeNull();
  });

  it("성립 알림: 이미 기록한 카테고리여도 띄운다", () => {
    const source = scriptedDiceSource([
      [4, 4, 4, 4, 4],
      [3, 3, 3, 3, 3],
    ]);
    const turn2 = ok(
      roll(ok(record(ok(roll(startGame(["플레이어 1"]), source)), "yacht")), source),
    );

    expect(comboCallout(turn2)).toBe("yacht");
  });
});
