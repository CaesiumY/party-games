import { describe, expect, it } from "vitest";
import type { DiceSource } from "../engine/dice-source";
import { CATEGORIES, type Category, type DieValue } from "../engine/types";
import { createGameStore, type GameStore } from "./game-store";

/** 언제나 다섯 개 모두 같은 눈. */
const always =
  (face: DieValue): DiceSource =>
  ({ count }) =>
    Array.from({ length: count }, () => face);

const FOUR = ["가람", "나래", "다솜", "라온"];

function versusStore(players = FOUR.slice(0, 2), source = always(6)) {
  return createGameStore({ players, diceSource: source });
}

/** 지금 플레이어가 한 번 굴리고(연출은 곧바로 끝난 것으로) 그 카테고리에 기록한다. 없으면 맨 위 빈 칸. */
function playTurn(store: GameStore, category?: Category) {
  if (!store.getState().roll().ok) throw new Error("굴릴 수 없다");
  const { presentation } = store.getState();
  if (presentation.phase !== "idle") {
    store.getState().presenterStopped(presentation.rollId);
    store.getState().presenterLinedUp(presentation.rollId);
  }
  const { game } = store.getState();
  const scores = game.players[game.currentPlayer]?.scores ?? {};
  const target = category ?? CATEGORIES.find((c) => scores[c] === undefined);
  if (!target) throw new Error("빈 카테고리가 없다");
  store.getState().select(target);
  if (!store.getState().record().ok) throw new Error("기록할 수 없다");
}

/** 떠 있는 알림·배너가 모두 끝난 것으로 한다. */
function endNotices(store: GameStore) {
  const notice = store.getState().bonusNotice;
  if (notice) store.getState().bonusNoticeEnded(notice.id);
  const banner = store.getState().turnBanner;
  if (banner) store.getState().turnBannerEnded(banner.id);
}

describe("차례 배너", () => {
  it("대전 모드에서 기록하면 다음 플레이어의 차례 배너가 뜬다. 굴림은 막지 않고 「?」만 막는다", () => {
    const store = versusStore();
    expect(store.getState().turnBanner).toBeNull();

    playTurn(store);

    expect(store.getState().turnBanner).toMatchObject({ player: 1 });
    expect(store.getState().shownPlayer()).toBe(1);
    expect(store.getState().permissions().canOpenHelp).toBe(false);
    expect(store.getState().permissions().canRoll).toBe(true);
  });

  it("배너 표시가 끝나면 지워지고 「?」를 다시 열 수 있다. 다른 배너 번호로는 지우지 않는다", () => {
    const store = versusStore();
    playTurn(store);
    const banner = store.getState().turnBanner;
    if (!banner) throw new Error("배너가 없다");

    store.getState().turnBannerEnded(banner.id + 1);
    expect(store.getState().turnBanner).toEqual(banner);

    store.getState().turnBannerEnded(banner.id);
    expect(store.getState().turnBanner).toBeNull();
    expect(store.getState().permissions().canOpenHelp).toBe(true);
  });

  it("마지막 플레이어 다음에는 첫 플레이어의 배너가 뜬다", () => {
    const store = versusStore(FOUR.slice(0, 3));
    playTurn(store);
    playTurn(store);
    playTurn(store);

    expect(store.getState().turnBanner).toMatchObject({ player: 0 });
  });

  it("보너스 알림이 뜬 기록이면 배너는 알림이 끝난 뒤 다음 플레이어로 뜬다", () => {
    // 턴 1·2·3 의 눈은 모두 6·5·4. 식스 30 → 파이브 25(소계 55) → 포 20(소계 75, 처음 63 이상이라 +35).
    const byTurn: DiceSource = ({ count, turn }) =>
      Array.from({ length: count }, () => (7 - turn) as DieValue);
    const store = versusStore(FOUR.slice(0, 2), byTurn);
    for (const category of ["sixes", "sixes", "fives", "fives"] as const) {
      playTurn(store, category);
      endNotices(store);
    }
    playTurn(store, "fours");

    expect(store.getState().bonusNotice).toMatchObject({ player: 0, notice: "+35" });
    expect(store.getState().turnBanner).toBeNull();

    const notice = store.getState().bonusNotice;
    if (notice) store.getState().bonusNoticeEnded(notice.id);

    expect(store.getState().turnBanner).toMatchObject({ player: 1 });
  });

  it("연습 모드에는 차례 배너가 없다", () => {
    const store = versusStore(["플레이어 1"]);
    playTurn(store);
    playTurn(store);

    expect(store.getState().turnBanner).toBeNull();
  });
});

describe("대전 모드의 결과 화면", () => {
  it("마지막 플레이어의 12번째 기록 뒤 결과 화면이 뜨고, 배너는 뜨지 않는다", () => {
    const store = versusStore();
    for (let i = 0; i < 23; i++) {
      playTurn(store);
      endNotices(store);
    }
    expect(store.getState().resultVisible()).toBe(false);

    playTurn(store);

    expect(store.getState().game.finished).toBe(true);
    expect(store.getState().turnBanner).toBeNull();
    expect(store.getState().resultVisible()).toBe(true);
  });

  it("마지막 기록이 보너스 알림을 낳으면 결과 화면은 알림이 끝난 뒤에 뜨고, 그때도 배너는 없다", () => {
    // 다섯 개 모두 1, 아랫칸부터 채우고 윗칸을 맨 뒤에: 마지막 기록(식스)에서 윗칸이 다 차고 소계 5 → +0.
    const order = [...CATEGORIES.slice(6), ...CATEGORIES.slice(0, 6)];
    const store = versusStore(FOUR.slice(0, 2), always(1));
    for (const category of order) {
      for (let p = 0; p < 2; p++) {
        playTurn(store, category);
        if (!store.getState().game.finished) endNotices(store);
      }
    }

    expect(store.getState().game.finished).toBe(true);
    expect(store.getState().bonusNotice).toMatchObject({ player: 1, notice: "+0" });
    expect(store.getState().resultVisible()).toBe(false);

    const notice = store.getState().bonusNotice;
    if (notice) store.getState().bonusNoticeEnded(notice.id);

    expect(store.getState().resultVisible()).toBe(true);
    expect(store.getState().turnBanner).toBeNull();
  });

  it("「같은 멤버로 다시」는 같은 인원·이름·순서로 첫 턴부터 새 게임을 연다", () => {
    const store = versusStore(FOUR);
    for (let i = 0; i < 48; i++) {
      playTurn(store);
      endNotices(store);
    }
    expect(store.getState().resultVisible()).toBe(true);

    store.getState().restart();

    const { game } = store.getState();
    expect(game.players.map((p) => p.name)).toEqual(FOUR);
    expect([game.turn, game.currentPlayer, game.finished]).toEqual([1, 0, false]);
    expect(store.getState().turnBanner).toBeNull();
    expect(store.getState().resultVisible()).toBe(false);
  });
});
