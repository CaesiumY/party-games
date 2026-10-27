import { describe, expect, it } from "vitest";
import { contributingFor, scoreFor } from "./scoring";

describe("윗칸: 해당 눈의 합", () => {
  it("에이스~식스는 그 눈을 가진 주사위의 눈만 더한다", () => {
    const dice = [1, 1, 3, 6, 6] as const;

    expect(scoreFor("aces", dice)).toBe(2);
    expect(scoreFor("deuces", dice)).toBe(0);
    expect(scoreFor("treys", dice)).toBe(3);
    expect(scoreFor("fours", dice)).toBe(0);
    expect(scoreFor("fives", dice)).toBe(0);
    expect(scoreFor("sixes", dice)).toBe(12);
  });
});

describe("포 다이스: 같은 눈 4개 이상이면 다섯 눈 전체의 합", () => {
  it("같은 눈 4개면 다섯 눈을 다 더한다", () => {
    expect(scoreFor("fourDice", [5, 2, 5, 5, 5])).toBe(22);
  });

  it("같은 눈 5개도 성립한다", () => {
    expect(scoreFor("fourDice", [3, 3, 3, 3, 3])).toBe(15);
  });

  it("같은 눈이 3개뿐이면 스크래치로 0점이다", () => {
    expect(scoreFor("fourDice", [6, 6, 6, 5, 5])).toBe(0);
  });
});

describe("풀 하우스: 3개+2개, 또는 같은 눈 5개면 다섯 눈 전체의 합", () => {
  it("같은 눈 3개와 다른 같은 눈 2개면 다섯 눈을 다 더한다", () => {
    expect(scoreFor("fullHouse", [2, 5, 2, 5, 2])).toBe(16);
  });

  it("66666 도 풀 하우스로 인정해 30점이다", () => {
    expect(scoreFor("fullHouse", [6, 6, 6, 6, 6])).toBe(30);
  });

  it("같은 눈 4개+1개나 3개+1개+1개는 스크래치로 0점이다", () => {
    expect(scoreFor("fullHouse", [4, 4, 4, 4, 1])).toBe(0);
    expect(scoreFor("fullHouse", [4, 4, 4, 2, 1])).toBe(0);
  });
});

describe("S. 스트레이트: 눈 4개가 연속이면 15점", () => {
  it("1234·2345·3456 이 들어 있으면 순서와 상관없이 15점이다", () => {
    expect(scoreFor("sStraight", [4, 1, 3, 2, 6])).toBe(15);
    expect(scoreFor("sStraight", [5, 3, 2, 4, 2])).toBe(15);
    expect(scoreFor("sStraight", [6, 5, 4, 3, 1])).toBe(15);
  });

  it("12345 처럼 5개 연속도 S. 스트레이트로 성립한다", () => {
    expect(scoreFor("sStraight", [1, 2, 3, 4, 5])).toBe(15);
  });

  it("11234 처럼 중복된 눈이 섞여도 성립한다", () => {
    expect(scoreFor("sStraight", [1, 1, 2, 3, 4])).toBe(15);
  });

  it("연속이 3개뿐이면 스크래치로 0점이다", () => {
    expect(scoreFor("sStraight", [1, 2, 3, 5, 6])).toBe(0);
  });
});

describe("L. 스트레이트: 눈 5개가 연속이면 30점", () => {
  it("12345·23456 이면 순서와 상관없이 30점이다", () => {
    expect(scoreFor("lStraight", [5, 4, 3, 2, 1])).toBe(30);
    expect(scoreFor("lStraight", [2, 6, 3, 5, 4])).toBe(30);
  });

  it("11234 처럼 4개만 연속이면 스크래치로 0점이다", () => {
    expect(scoreFor("lStraight", [1, 1, 2, 3, 4])).toBe(0);
    expect(scoreFor("lStraight", [1, 2, 3, 4, 6])).toBe(0);
  });
});

describe("요트: 같은 눈 5개면 50점", () => {
  it("눈과 상관없이 같은 눈 5개면 50점이다", () => {
    expect(scoreFor("yacht", [1, 1, 1, 1, 1])).toBe(50);
    expect(scoreFor("yacht", [6, 6, 6, 6, 6])).toBe(50);
  });

  it("같은 눈 4개면 스크래치로 0점이다", () => {
    expect(scoreFor("yacht", [6, 6, 6, 6, 5])).toBe(0);
  });
});

describe("기여 주사위: 점수에 보태는 주사위(주사위 순번)", () => {
  it("에이스는 1인 주사위만 기여한다", () => {
    expect(contributingFor("aces", [1, 3, 1, 6, 2])).toEqual([0, 2]);
  });

  it("11234 의 S. 스트레이트는 1·2·3·4 가 하나씩 기여한다(겹친 1 은 하나만)", () => {
    expect(contributingFor("sStraight", [1, 1, 2, 3, 4])).toEqual([0, 2, 3, 4]);
  });

  it("12345 의 S. 스트레이트는 낮은 쪽 네 눈(1·2·3·4)이 기여한다", () => {
    expect(contributingFor("sStraight", [5, 4, 3, 2, 1])).toEqual([1, 2, 3, 4]);
  });

  it("초이스·포 다이스·풀 하우스·요트·L. 스트레이트는 성립하면 다섯 개 모두 기여한다", () => {
    const all = [0, 1, 2, 3, 4];
    expect(contributingFor("choice", [1, 3, 4, 6, 2])).toEqual(all);
    expect(contributingFor("fourDice", [5, 2, 5, 5, 5])).toEqual(all);
    expect(contributingFor("fullHouse", [2, 5, 2, 5, 2])).toEqual(all);
    expect(contributingFor("yacht", [6, 6, 6, 6, 6])).toEqual(all);
    expect(contributingFor("lStraight", [2, 6, 3, 5, 4])).toEqual(all);
  });

  it("스크래치면 기여 주사위가 없다", () => {
    expect(contributingFor("sixes", [1, 2, 3, 4, 5])).toEqual([]);
    expect(contributingFor("fourDice", [6, 6, 6, 5, 5])).toEqual([]);
    expect(contributingFor("fullHouse", [4, 4, 4, 4, 1])).toEqual([]);
    expect(contributingFor("sStraight", [1, 2, 3, 5, 6])).toEqual([]);
    expect(contributingFor("lStraight", [1, 1, 2, 3, 4])).toEqual([]);
    expect(contributingFor("yacht", [6, 6, 6, 6, 5])).toEqual([]);
  });
});
