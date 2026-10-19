import { describe, expect, it } from "vitest";
import { startGame } from "./game";
import { ranking } from "./ranking";
import type { GameState, PlayerState } from "./types";

/** 이름과 초이스 점수만 적힌 플레이어들로 게임 상태를 만든다(총합 득점 = 초이스 점수). */
function withChoices(choices: number[]): GameState {
  const game = startGame(choices.map((_, i) => `플레이어 ${i + 1}`));
  const players: PlayerState[] = game.players.map((player, i) => ({
    ...player,
    scores: { choice: choices[i] ?? 0 },
  }));
  return { ...game, players };
}

describe("순위", () => {
  it("총합 득점이 높은 순서로 1위부터 매긴다", () => {
    expect(ranking(withChoices([12, 25, 18]))).toEqual([
      { player: 1, total: 25, rank: 1 },
      { player: 2, total: 18, rank: 2 },
      { player: 0, total: 12, rank: 3 },
    ]);
  });

  it("총합 득점이 같으면 같은 순위이고, 다음 순위는 그 인원만큼 건너뛴다", () => {
    expect(ranking(withChoices([20, 30, 20, 10])).map((s) => [s.player, s.rank])).toEqual([
      [1, 1],
      [0, 2],
      [2, 2],
      [3, 4],
    ]);
  });

  it("셋이 공동 1위면 모두 1위, 남은 한 명은 4위다", () => {
    expect(ranking(withChoices([15, 15, 9, 15])).map((s) => [s.player, s.rank])).toEqual([
      [0, 1],
      [1, 1],
      [3, 1],
      [2, 4],
    ]);
  });

  it("윗칸 보너스까지 더한 총합 득점으로 매긴다", () => {
    const game = withChoices([40, 0]);
    const bonus: PlayerState = {
      name: "플레이어 2",
      scores: { fours: 20, fives: 25, sixes: 30 }, // 소계 75 → 보너스 35, 총합 110
    };
    const state = { ...game, players: [game.players[0] as PlayerState, bonus] };

    expect(ranking(state)[0]).toEqual({ player: 1, total: 110, rank: 1 });
  });
});
