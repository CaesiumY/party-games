import { totalScore } from "./totals";
import type { GameState } from "./types";

/** 순위 표의 한 줄. */
export interface Standing {
  /** 플레이어 순번(0부터, `GameState.players` 의 자리). */
  player: number;
  total: number;
  /** 1부터. 총합 득점이 같으면 같은 순위다. */
  rank: number;
}

/**
 * 순위: 총합 득점이 높은 순서. 총합 득점이 같으면 같은 순위이고 타이브레이크는 없다.
 * 다음 순위는 같은 순위의 인원만큼 건너뛴다(20·20·10 → 1·1·3). 같은 점수끼리는 순번 순서로 놓는다.
 */
export function ranking(state: GameState): Standing[] {
  const sorted = state.players
    .map((player, i) => ({ player: i, total: totalScore(player) }))
    .sort((a, b) => b.total - a.total || a.player - b.player);
  return sorted.map((entry) => ({
    ...entry,
    rank: 1 + sorted.filter((other) => other.total > entry.total).length,
  }));
}
