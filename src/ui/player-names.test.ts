import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, playerNames } from "./player-names";

describe("시작 화면의 플레이어 이름", () => {
  it("비운 칸은 자리 번호의 「플레이어 n」이고, 앞뒤 공백은 지운다", () => {
    expect(playerNames(["  가람 ", "", ""])).toEqual(["가람", "플레이어 2", "플레이어 3"]);
  });

  it("비운 칸의 기본 이름이 직접 넣은 이름과 겹치면, 겹치지 않는 가장 작은 「플레이어 n」을 쓴다", () => {
    expect(playerNames(["플레이어 2", ""])).toEqual(["플레이어 2", "플레이어 1"]);
    expect(playerNames(["", "플레이어 1"])).toEqual(["플레이어 2", "플레이어 1"]);
  });

  it("직접 넣은 이름끼리 겹칠 때만 뒤의 것에 「 2」「 3」을 붙인다", () => {
    expect(playerNames(["가람", "가람", "가람"])).toEqual(["가람", "가람 2", "가람 3"]);
  });

  it("번호를 붙여 8자를 넘으면 앞부분을 잘라 8자 안에 맞춘다", () => {
    const long = "가나다라마바사아";
    expect(long).toHaveLength(NAME_MAX_LENGTH);

    expect(playerNames([long, long])).toEqual([long, "가나다라마바 2"]);
  });
});
