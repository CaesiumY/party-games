// 게임 엔진의 데이터 모양. 모두 JSON 으로 그대로 저장·복원할 수 있는 단순 데이터다.

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** 주사위 다섯 개 각각의 정체성. 턴 안에서 바뀌지 않는다. */
export type DieId = 0 | 1 | 2 | 3 | 4;

export const DIE_IDS: readonly DieId[] = [0, 1, 2, 3, 4];

export interface Die {
  id: DieId;
  value: DieValue;
  held: boolean;
}

/**
 * 카테고리 열두 개. 점수표의 위에서 아래 순서.
 * 식별자는 용어집의 한국어판 이름을 그대로 옮겼다(포 다이스 → fourDice, S. 스트레이트 → sStraight).
 * 화면 이름은 src/ui/category-names.ts 에 있다.
 */
export const CATEGORIES = [
  "aces",
  "deuces",
  "treys",
  "fours",
  "fives",
  "sixes",
  "choice",
  "fourDice",
  "fullHouse",
  "sStraight",
  "lStraight",
  "yacht",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface PlayerState {
  name: string;
  /** 기록한 카테고리만 키가 있다. */
  scores: Partial<Record<Category, number>>;
}

export interface GameState {
  players: PlayerState[];
  /** 지금 차례인 플레이어의 순번(0부터). */
  currentPlayer: number;
  /** 턴 번호. 1부터 12까지. */
  turn: number;
  /** 이번 턴에 한 굴림 횟수. 0이면 아직 첫 굴림 전이다. */
  rollsUsed: number;
  /** 주사위 다섯 개. 배열 순번이 곧 DieId 다. 화면의 열 순서와는 상관없다. */
  dice: Die[];
  finished: boolean;
}

/** 규칙에 맞지 않아 거부된 이유. */
export type Rejection =
  | "game-over"
  | "not-rolled-yet"
  | "no-rolls-left"
  | "all-held"
  | "category-filled"
  | "category-unavailable";

/**
 * 모든 엔진 명령의 결과. 규칙에 맞지 않는 명령은 예외를 던지지 않고
 * 상태를 바꾸지 않은 채 `{ ok: false, reason }` 을 돌려준다.
 */
export type CommandResult = { ok: true; state: GameState } | { ok: false; reason: Rejection };
