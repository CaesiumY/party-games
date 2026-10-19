import { describe, expect, it } from "vitest";
import type { DiceSource } from "../engine/dice-source";
import { CATEGORIES, type DieValue } from "../engine/types";
import { bestScoreValue } from "./best-score";
import { createGameStore, type GameStore } from "./game-store";
import { savedGameValue } from "./saved-game";
import { type KeyValueStorage, memoryStorage } from "./stored-value";

/** 굴림 요청만으로 눈이 정해지는 공급원. 새로고침한 뒤에도 같은 굴림에는 같은 눈이 나온다. */
const source: DiceSource = ({ player, turn, rollNumber, count }) =>
  Array.from(
    { length: count },
    (_, i) => (((player + turn * 3 + rollNumber + i) % 6) + 1) as DieValue,
  );

/** 다섯 개 모두 6. 맨 위 빈 카테고리부터 채우면 식스에서 윗칸 보너스가 정해진다. */
const allSixes: DiceSource = ({ count }) => Array.from({ length: count }, (): DieValue => 6);

/** 이 기기의 브라우저 저장소를 쓰는 앱 하나. 같은 저장소로 다시 만들면 새로고침이다. */
function openApp(storage: KeyValueStorage, diceSource: DiceSource = source): GameStore {
  return createGameStore({
    diceSource,
    bestScore: bestScoreValue(storage),
    savedGame: savedGameValue(storage),
  });
}

/** 연출 입구처럼 멈춤과 정렬 끝을 알린다. */
function finishAnimation(store: GameStore) {
  const { presentation } = store.getState();
  if (presentation.phase === "idle") return;
  store.getState().presenterStopped(presentation.rollId);
  store.getState().presenterLinedUp(presentation.rollId);
}

/** 굴리고 연출을 끝낸 뒤 맨 위 빈 카테고리에 기록한다. 보너스 알림은 끝난 것으로 알린다. */
function playTurn(store: GameStore) {
  if (!store.getState().roll().ok) throw new Error("굴릴 수 없다");
  finishAnimation(store);
  const { game } = store.getState();
  const scores = game.players[game.currentPlayer]?.scores ?? {};
  const empty = CATEGORIES.find((category) => scores[category] === undefined);
  if (!empty || !store.getState().select(empty).ok || !store.getState().record().ok) {
    throw new Error("기록할 수 없다");
  }
  const notice = store.getState().bonusNotice;
  if (notice) store.getState().bonusNoticeEnded(notice.id);
}

describe("이어 하기", () => {
  it("이어 할 게임이 없으면 시작 화면에 이어 하기가 없다", () => {
    const store = openApp(memoryStorage());

    expect(store.getState().screen).toBe("start");
    expect(store.getState().resumable).toBeNull();
  });

  it("굴림 결과는 굴림 명령 때 저장되어, 연출 도중 새로고침해도 같은 결과에서 이어 한다", () => {
    const storage = memoryStorage();
    const before = openApp(storage);
    before.getState().newGame(["플레이어 1"]);
    before.getState().roll();
    expect(before.getState().presentation.phase).toBe("rolling");

    const after = openApp(storage);
    expect(after.getState().screen).toBe("start");
    expect(after.getState().resumable).toEqual(before.getState().game);

    after.getState().resume();
    const s = after.getState();
    expect(s.screen).toBe("game");
    expect(s.game).toEqual(before.getState().game);
    expect(s.game.rollsUsed).toBe(1);
    // 연출은 다시 틀지 않는다. 주사위는 정렬이 끝난 채로 놓이고 조작이 잠기지 않는다.
    expect(s.presentation).toEqual({ phase: "idle" });
    expect(s.rollId).toBe(0);
    expect(s.previewVisible()).toBe(true);
    expect(s.permissions().canRoll).toBe(true);
    expect(s.permissions().canHold(0)).toBe(true);
    expect(s.callout).toBeNull();
  });

  it("새로고침해도 다시 굴리지 못한다: 3번째 굴림 도중 새로고침하면 남은 굴림 없이 다섯 개 모두 홀드 자리다", () => {
    const storage = memoryStorage();
    const before = openApp(storage);
    before.getState().newGame(["플레이어 1"]);
    for (let i = 0; i < 2; i++) {
      before.getState().roll();
      finishAnimation(before);
    }
    before.getState().roll();

    const after = openApp(storage);
    after.getState().resume();
    const s = after.getState();
    expect(s.game.dice).toEqual(before.getState().game.dice);
    expect(s.permissions().canRoll).toBe(false);
    expect(s.roll()).toEqual({ ok: false, reason: "no-rolls-left" });
    expect(s.slots().every((slot) => slot.row === "hold")).toBe(true);
    expect(s.movingDice).toEqual([]);
  });

  it("홀드 상태와 점수표, 2인 게임의 지금 차례까지 그대로 이어 한다", () => {
    const storage = memoryStorage();
    const before = openApp(storage);
    before.getState().newGame(["가", "나"]);
    playTurn(before);
    playTurn(before);
    playTurn(before);
    before.getState().roll();
    finishAnimation(before);
    before.getState().toggleHold(1);
    before.getState().toggleHold(3);

    const after = openApp(storage);
    after.getState().resume();
    const s = after.getState();
    expect(s.game).toEqual(before.getState().game);
    expect(s.game).toMatchObject({ turn: 2, currentPlayer: 1, rollsUsed: 1 });
    expect(s.game.dice.filter((d) => d.held).map((d) => d.id)).toEqual([1, 3]);
    expect(s.shownPlayer()).toBe(1);
    expect(s.turnBanner).toBeNull();
    // 홀드한 주사위는 홀드 자리, 나머지는 정렬 줄에 놓인다.
    expect(s.slots().map((slot) => slot.row)).toEqual([
      "lineup",
      "hold",
      "lineup",
      "hold",
      "lineup",
    ]);
  });

  it("보너스 알림 도중 새로고침하면 알림 없이 다음 차례에서 이어 한다", () => {
    const storage = memoryStorage();
    const before = openApp(storage, allSixes);
    before.getState().newGame(["가", "나"]);
    // 가가 식스까지 채워 윗칸 보너스가 정해지는 기록에서 멈춘다(알림을 끝내지 않음).
    for (let i = 0; i < 10; i++) playTurn(before);
    before.getState().roll();
    finishAnimation(before);
    before.getState().select("sixes");
    before.getState().record();
    expect(before.getState().bonusNotice).not.toBeNull();

    const after = openApp(storage, allSixes);
    after.getState().resume();
    const s = after.getState();
    expect(s.bonusNotice).toBeNull();
    expect(s.game.currentPlayer).toBe(1);
    expect(s.shownPlayer()).toBe(1);
    expect(s.permissions().canRoll).toBe(true);
  });

  it("게임이 끝나면 진행 중 게임을 지워, 다시 열어도 이어 할 게임이 없다", () => {
    const storage = memoryStorage();
    const before = openApp(storage);
    before.getState().newGame(["플레이어 1"]);
    while (!before.getState().game.finished) playTurn(before);

    expect(savedGameValue(storage).read()).toBeNull();
    expect(openApp(storage).getState().resumable).toBeNull();
  });

  it("이어 한 게임을 끝까지 하면 끊기지 않은 게임과 같은 결과이고, 최고 점수도 정해진다", () => {
    const uninterrupted = openApp(memoryStorage());
    uninterrupted.getState().newGame(["플레이어 1"]);
    while (!uninterrupted.getState().game.finished) playTurn(uninterrupted);

    const storage = memoryStorage();
    const before = openApp(storage);
    before.getState().newGame(["플레이어 1"]);
    for (let i = 0; i < 5; i++) playTurn(before);
    const after = openApp(storage);
    after.getState().resume();
    while (!after.getState().game.finished) playTurn(after);

    expect(after.getState().game).toEqual(uninterrupted.getState().game);
    expect(after.getState().outcome).toEqual(uninterrupted.getState().outcome);
    expect(bestScoreValue(storage).read()).toBe(uninterrupted.getState().outcome?.best);
  });

  it("버전이 맞지 않는 진행 중 게임은 버리고, 최고 점수는 그대로 둔다", () => {
    const storage = memoryStorage();
    bestScoreValue(storage).write(120);
    storage.setItem("yacht.saved-game", JSON.stringify({ version: 0, value: {} }));

    const store = openApp(storage);
    expect(store.getState().resumable).toBeNull();
    expect(store.getState().best).toBe(120);
    expect(storage.getItem("yacht.saved-game")).toBeNull();
    expect(bestScoreValue(storage).read()).toBe(120);
  });

  it("이어 하지 않고 새 게임을 시작하면 저장된 게임은 새 게임으로 바뀐다", () => {
    const storage = memoryStorage();
    const before = openApp(storage);
    before.getState().newGame(["가", "나"]);
    playTurn(before);

    const after = openApp(storage);
    expect(after.getState().resumable).not.toBeNull();
    after.getState().newGame(["다"]);
    expect(after.getState().resumable).toBeNull();
    expect(
      savedGameValue(storage)
        .read()
        ?.players.map((p) => p.name),
    ).toEqual(["다"]);
  });
});
