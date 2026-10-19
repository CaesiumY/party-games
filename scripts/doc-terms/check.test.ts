import { describe, expect, it } from "vitest";
import { findAvoidedWords } from "./check.ts";

const glossary = `# 요트

**플레이어 (Player)**:
게임에 참가한 사람.
_Avoid_: 유저, 참가자
`;

describe("findAvoidedWords", () => {
  it("스펙에 피할 말이 조사와 붙어 쓰이면 그 줄과 원래 용어를 알려 준다", () => {
    const hits = findAvoidedWords({
      glossary,
      docs: [{ path: "docs/specs/a.md", text: "첫 줄\n주사위는 유저가 굴린다." }],
      allowlist: [],
    });

    expect(hits).toEqual([
      {
        path: "docs/specs/a.md",
        line: 2,
        column: 6,
        word: "유저",
        term: "플레이어",
        text: "주사위는 유저가 굴린다.",
      },
    ]);
  });

  it("한 글자짜리 피할 말은 그 말만으로 된 어절일 때만 걸린다", () => {
    const hits = findAvoidedWords({
      glossary: `**컵 (Cup)**:\n주사위를 담는 그릇.\n_Avoid_: 셰이커, 통\n`,
      docs: [{ path: "docs/specs/a.md", text: "검사를 통과했다.\n주사위를 통 안에 담는다." }],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.line, hit.word])).toEqual([[2, "통"]]);
  });

  it("가운뎃점이나 낫표로 이어 붙인 어절 안의 말도 그 경계에서부터 맞춰 본다", () => {
    const hits = findAvoidedWords({
      glossary: `**게임 (Game)**:\n한 판.\n_Avoid_: 매치, 라운드\n`,
      docs: [
        { path: "docs/specs/a.md", text: "탭은 「방법」·「라운드」 둘이다. 에이스·매치포인트." },
      ],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.word, hit.column])).toEqual([
      ["라운드", 10],
      ["매치", 24],
    ]);
  });

  it("피할 말 뒤 괄호 안의 풀이는 피할 말에 들지 않는다", () => {
    const hits = findAvoidedWords({
      glossary: `**열 (Column)**:\n세로 위치.\n_Avoid_: 칸(카테고리를 뜻함), 레인\n`,
      docs: [{ path: "docs/specs/a.md", text: "주사위는 왼쪽 칸 부터 놓인다." }],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.word, hit.term])).toEqual([["칸", "열"]]);
  });

  it("피할 말이 그 자체로 용어집의 표제어이면 검사하지 않는다", () => {
    const hits = findAvoidedWords({
      glossary: [
        "**최고 점수 (Best Score)**:",
        "가장 높은 값.",
        "_Avoid_: 하이스코어, 기록(‘기록’은 점수를 적는 행동을 뜻한다)",
        "",
        "**기록 (Score)**:",
        "점수를 적는 행동.",
        "_Avoid_: 확정, 입력",
      ].join("\n"),
      docs: [{ path: "docs/specs/a.md", text: "카테고리에 점수를 기록한다. 하이스코어를 본다." }],
      allowlist: [],
    });

    expect(hits.map((hit) => hit.word)).toEqual(["하이스코어"]);
  });

  it("여러 어절로 된 피할 말은 그 어절들이 이어서 나올 때 걸린다", () => {
    const hits = findAvoidedWords({
      glossary: `**차례 (Current Player)**:\n조작권을 가진 플레이어.\n_Avoid_: 순번, 현재 턴(사람을 가리킬 때)\n`,
      docs: [{ path: "docs/specs/a.md", text: "현재 점수와 턴 수.\n**현재 턴**이 끝나면 넘긴다." }],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.line, hit.word])).toEqual([[2, "현재 턴"]]);
  });

  it("허용 목록의 (피할 말, 구절) 짝에 든 쓰임은 빼고, 같은 말의 다른 쓰임은 그대로 걸린다", () => {
    const hits = findAvoidedWords({
      glossary: [
        "**굴림 연출 (Roll Animation)**:",
        "정해진 결과를 보여 주는 것.",
        "_Avoid_: 시뮬레이션, 물리 굴림",
        "",
        "**홀드 (Hold)**:",
        "주사위를 남겨 두는 것.",
        "_Avoid_: 킵, 고정, 잠금",
      ].join("\n"),
      docs: [
        {
          path: "docs/adr/0001.md",
          text: [
            "물리 시뮬레이션이 정하면 손맛은 진짜다.",
            "시뮬레이션을 돌린다.",
            "화면 문구는 「킵」이다.",
            "킵 한 주사위.",
          ].join("\n"),
        },
      ],
      allowlist: [
        { word: "시뮬레이션", phrase: "물리 시뮬레이션", reason: "물리 엔진이 결과를 정하는 방식" },
        { word: "킵", phrase: "「킵」", reason: "원작 화면 문구" },
      ],
    });

    expect(hits.map((hit) => [hit.line, hit.word])).toEqual([
      [2, "시뮬레이션"],
      [4, "킵"],
    ]);
  });

  it("한 어절에 허용된 쓰임과 허용되지 않은 쓰임이 함께 있으면 허용되지 않은 쪽은 걸린다", () => {
    const hits = findAvoidedWords({
      glossary: `**홀드 (Hold)**:\n주사위를 남겨 두는 것.\n_Avoid_: 킵, 고정\n`,
      docs: [{ path: "docs/specs/a.md", text: "문구 「킵」·킵 둘." }],
      allowlist: [{ word: "킵", phrase: "「킵」", reason: "원작 화면 문구" }],
    });

    expect(hits.map((hit) => [hit.word, hit.column])).toEqual([["킵", 8]]);
  });

  it("두 글자 이상의 피할 말도 한 어절 안의 쓰임을 하나하나 따로 본다", () => {
    const hits = findAvoidedWords({
      glossary: `**카테고리 (Category)**:\n점수를 기록하는 자리.\n_Avoid_: 족보, 항목\n`,
      docs: [{ path: "docs/specs/a.md", text: "탭 「족보」·족보를 본다." }],
      allowlist: [{ word: "족보", phrase: "「족보」", reason: "원작 탭 이름" }],
    });

    expect(hits.map((hit) => [hit.word, hit.column])).toEqual([["족보", 8]]);
  });

  it("강조·코드·링크 표시가 여러 어절로 된 피할 말을 갈라도 걸리고, 위치는 원문 기준이다", () => {
    const hits = findAvoidedWords({
      glossary: [
        "**대전 모드 (Versus Mode)**:",
        "여러 명이 하는 게임.",
        "_Avoid_: 파티 모드",
        "",
        "**핫시트 (Hot-seat)**:",
        "기기 하나를 넘겨 가며 하는 방식.",
        "_Avoid_: 로컬 멀티",
      ].join("\n"),
      docs: [
        {
          path: "docs/specs/a.md",
          text: [
            "대전은 파티 **모드**로 한다.",
            "[로컬](https://e.x/a) 멀티는 없다.",
            "`파티` 모드",
          ].join("\n"),
        },
      ],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.line, hit.column, hit.word])).toEqual([
      [1, 5, "파티 모드"],
      [2, 2, "로컬 멀티"],
      [3, 2, "파티 모드"],
    ]);
  });
});
