import { describe, expect, it } from "vitest";
import { type DiceSource, scriptedDiceSource } from "../engine/dice-source";
import { CATEGORIES, type DieValue } from "../engine/types";
import { bestScoreValue } from "./best-score";
import { createGameStore, type GameStore } from "./game-store";
import { type KeyValueStorage, memoryStorage } from "./stored-value";

/** 언제나 다섯 개 모두 6. 맨 위 빈 카테고리부터 채우면 식스·초이스·포 다이스·풀 하우스 30씩과 요트 50, 총합 득점 170이다. */
const allSixes: DiceSource = ({ count }) => Array.from({ length: count }, (): DieValue => 6);
const ALL_SIXES_TOTAL = 170;

function storageWithBest(best: number | null): KeyValueStorage {
  const storage = memoryStorage();
  if (best !== null) bestScoreValue(storage).write(best);
  return storage;
}

/** 지금 플레이어가 한 번 굴리고(연출은 곧바로 끝난 것으로) 맨 위 빈 카테고리에 기록한다. */
function playTurn(store: GameStore) {
  const s = store.getState();
  if (!s.roll().ok) throw new Error("굴릴 수 없다");
  const { presentation } = store.getState();
  if (presentation.phase !== "idle") {
    store.getState().presenterStopped(presentation.rollId);
    store.getState().presenterLinedUp(presentation.rollId);
  }
  const { game } = store.getState();
  const scores = game.players[game.currentPlayer]?.scores ?? {};
  const empty = CATEGORIES.find((category) => scores[category] === undefined);
  if (!empty) throw new Error("빈 카테고리가 없다");
  store.getState().select(empty);
  if (!store.getState().record().ok) throw new Error("기록할 수 없다");
  // 보너스 알림이 뜨면 그 표시가 끝난 것으로 한다(그동안은 굴릴 수 없다).
  const notice = store.getState().bonusNotice;
  if (notice) store.getState().bonusNoticeEnded(notice.id);
}

function playToEnd(store: GameStore) {
  while (!store.getState().game.finished) playTurn(store);
}

function practiceStore(storage: KeyValueStorage) {
  return createGameStore({
    players: ["플레이어 1"],
    diceSource: allSixes,
    bestScore: bestScoreValue(storage),
  });
}

describe("연습 모드의 최고 점수", () => {
  it("최고 점수를 넘으면 새 최고 점수로 이 기기에 저장하고 알린다", () => {
    const storage = storageWithBest(150);
    const store = practiceStore(storage);
    expect(store.getState().best).toBe(150);

    playToEnd(store);

    expect(store.getState().outcome).toEqual({
      total: ALL_SIXES_TOTAL,
      best: ALL_SIXES_TOTAL,
      isNewBest: true,
    });
    expect(store.getState().best).toBe(ALL_SIXES_TOTAL);
    expect(bestScoreValue(storage).read()).toBe(ALL_SIXES_TOTAL);
  });

  it("최고 점수에 못 미치거나 같으면 최고 점수는 그대로다", () => {
    for (const previous of [250, ALL_SIXES_TOTAL]) {
      const storage = storageWithBest(previous);
      const store = practiceStore(storage);

      playToEnd(store);

      expect(store.getState().outcome).toEqual({
        total: ALL_SIXES_TOTAL,
        best: previous,
        isNewBest: false,
      });
      expect(bestScoreValue(storage).read()).toBe(previous);
    }
  });

  it("이 기기의 첫 판이면 그 점수가 새 최고 점수다", () => {
    const storage = storageWithBest(null);
    const store = practiceStore(storage);
    expect(store.getState().best).toBeNull();

    playToEnd(store);

    expect(store.getState().outcome?.isNewBest).toBe(true);
    expect(bestScoreValue(storage).read()).toBe(ALL_SIXES_TOTAL);
  });

  it("대전 모드는 최고 점수를 저장하지 않는다", () => {
    const storage = storageWithBest(null);
    const store = createGameStore({
      players: ["플레이어 1", "플레이어 2"],
      diceSource: allSixes,
      bestScore: bestScoreValue(storage),
    });

    playToEnd(store);

    expect(store.getState().outcome).toBeNull();
    expect(bestScoreValue(storage).read()).toBeNull();
  });

  it("게임 도중에는 결과가 없다", () => {
    const store = practiceStore(storageWithBest(null));
    playTurn(store);

    expect(store.getState().outcome).toBeNull();
    expect(store.getState().resultVisible()).toBe(false);
  });
});

describe("시작 화면과 결과 화면 사이", () => {
  it("인원을 정하지 않고 열면 시작 화면이고, 새 게임을 시작하면 게임 화면이 된다", () => {
    const store = createGameStore({ diceSource: scriptedDiceSource([]) });
    expect(store.getState().screen).toBe("start");

    store.getState().newGame(["플레이어 1"]);

    expect(store.getState().screen).toBe("game");
    expect(store.getState().game.players.map((p) => p.name)).toEqual(["플레이어 1"]);
  });

  it("마지막 기록 뒤 결과 화면이 뜨고, 「같은 멤버로 다시」는 같은 플레이어로 첫 턴부터 새 게임을 연다", () => {
    const store = practiceStore(storageWithBest(null));
    playToEnd(store);
    expect(store.getState().resultVisible()).toBe(true);

    store.getState().restart();

    const { game, outcome, screen } = store.getState();
    expect(screen).toBe("game");
    expect(store.getState().resultVisible()).toBe(false);
    expect(outcome).toBeNull();
    expect(game.players).toEqual([{ name: "플레이어 1", scores: {} }]);
    expect([game.turn, game.rollsUsed, game.finished]).toEqual([1, 0, false]);
    expect(store.getState().roll()).toEqual({ ok: true });
  });

  it("「처음으로」는 시작 화면을 열고, 시작 화면은 방금 바뀐 최고 점수를 보여 준다", () => {
    const store = practiceStore(storageWithBest(120));
    playToEnd(store);

    store.getState().goHome();

    expect(store.getState().screen).toBe("start");
    expect(store.getState().resultVisible()).toBe(false);
    expect(store.getState().best).toBe(ALL_SIXES_TOTAL);
  });
});
