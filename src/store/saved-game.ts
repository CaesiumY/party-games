import { ROLLS_PER_TURN } from "../engine/game";
import {
  CATEGORIES,
  type Category,
  DIE_IDS,
  type Die,
  type DieValue,
  type GameState,
  type PlayerState,
} from "../engine/types";
import { MAX_PLAYERS } from "./player-cap";
import { createStoredValue, type KeyValueStorage, type StoredValue } from "./stored-value";

/** 한 카테고리에 적힐 수 있는 가장 큰 점수(요트 50). */
const MAX_POINTS = 50;
const TURNS = 12;

/** 저장한 진행 중 게임. */
export interface SavedGame {
  /** 엔진의 게임 상태. */
  game: GameState;
  /**
   * 주사위마다 놓인 열(DieId 순서). 화면이 정하는 표현이지만, 이어 했을 때 주사위가 저장 전과 같은 칸에
   * 놓이도록 함께 둔다. 열은 굴림이 끝날 때만 다시 정해지므로 게임 상태만으로는 되살릴 수 없다.
   */
  columns: number[];
}

/**
 * 진행 중 게임(스펙 「영속화」). 엔진의 게임 상태와 주사위의 열만 저장한다. 굴림 연출 단계·선택·성립 알림·
 * 보너스 알림·차례 배너 같은 화면 상태는 저장하지 않는다. 끝난 게임은 이어 할 수 없으므로 읽지 않고 버린다.
 * 열이 맞지 않으면(같은 열이 두 번 등) 다시 계산하지 않고 항목을 버린다.
 */
export function savedGameValue(storage: KeyValueStorage | null): StoredValue<SavedGame> {
  return createStoredValue({ storage, key: "yacht.saved-game", version: 1, parse: parseSaved });
}

function parseSaved(value: unknown): SavedGame | null {
  if (!isRecord(value)) return null;
  const game = parseGame(value.game);
  const columns = parseColumns(value.columns);
  return game && columns ? { game, columns } : null;
}

/** 다섯 주사위가 다섯 열에 하나씩 놓였는지(0~4 의 순열). */
function parseColumns(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== DIE_IDS.length) return null;
  if (!value.every((column) => isIntIn(column, 0, DIE_IDS.length - 1))) return null;
  return new Set(value).size === value.length ? (value as number[]) : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIntIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);

function parsePlayer(value: unknown): PlayerState | null {
  if (!isRecord(value) || typeof value.name !== "string" || !isRecord(value.scores)) return null;
  const scores: Partial<Record<Category, number>> = {};
  for (const [category, points] of Object.entries(value.scores)) {
    if (!CATEGORY_SET.has(category) || !isIntIn(points, 0, MAX_POINTS)) return null;
    scores[category as Category] = points;
  }
  return { name: value.name, scores };
}

function parseDie(value: unknown, index: number): Die | null {
  // 배열 순번이 곧 DieId 다.
  const id = DIE_IDS[index];
  if (id === undefined || !isRecord(value) || value.id !== id) return null;
  if (!isIntIn(value.value, 1, 6) || typeof value.held !== "boolean") return null;
  return { id, value: value.value as DieValue, held: value.held };
}

/**
 * 이어 할 수 있는 게임 상태인지 확인한다. 모양이 맞지 않거나 끝난 게임, 지금 받는 인원(`MAX_PLAYERS`)보다
 * 많은 게임이면 null.
 */
function parseGame(value: unknown): GameState | null {
  if (!isRecord(value) || value.finished !== false) return null;
  const { players, dice, currentPlayer, turn, rollsUsed } = value;
  if (!Array.isArray(players) || players.length < 1 || players.length > MAX_PLAYERS) return null;
  if (!Array.isArray(dice) || dice.length !== DIE_IDS.length) return null;
  if (!isIntIn(currentPlayer, 0, players.length - 1)) return null;
  if (!isIntIn(turn, 1, TURNS) || !isIntIn(rollsUsed, 0, ROLLS_PER_TURN)) return null;
  const parsedPlayers = players.map(parsePlayer);
  const parsedDice = dice.map(parseDie);
  if (parsedPlayers.some((p) => p === null) || parsedDice.some((d) => d === null)) return null;
  return {
    players: parsedPlayers as PlayerState[],
    currentPlayer,
    turn,
    rollsUsed,
    dice: parsedDice as Die[],
    finished: false,
  };
}
