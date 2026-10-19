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

  it("한 문단 안에서 줄바꿈으로 갈린 여러 어절짜리 피할 말도 걸리고, 블록이 바뀌는 곳은 잇지 않는다", () => {
    const hits = findAvoidedWords({
      glossary: `**대전 모드 (Versus Mode)**:\n여러 명이 하는 게임.\n_Avoid_: 파티 모드\n`,
      docs: [
        {
          path: "docs/specs/a.md",
          text: [
            "대전은 파티", // 1: 다음 줄과 한 문단
            "모드로 한다.",
            "파티", // 3: 빈 줄 너머
            "",
            "모드",
            "- 파티", // 6: 목록 항목끼리
            "- 모드",
            "# 파티", // 8: 제목 다음
            "모드",
            "| 파티 |", // 10: 표의 칸끼리
            "| --- |",
            "| 모드 |",
            "```",
            "파티", // 13: 코드 블록 안
            "모드",
            "```",
          ].join("\n"),
        },
      ],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.line, hit.column, hit.text])).toEqual([[1, 5, "대전은 파티"]]);
  });

  it("참조 링크도 글자만 남겨 맞춰 보고, 링크 정의 줄은 보지 않는다", () => {
    const hits = findAvoidedWords({
      glossary: `**대전 모드 (Versus Mode)**:\n여러 명이 하는 게임.\n_Avoid_: 파티 모드, 멀티\n`,
      docs: [
        {
          path: "docs/specs/a.md",
          text: [
            "[파티][mode] 모드는 없다.",
            "[파티][] 모드도 없다.",
            "[파티] 모드도 없다.",
            "[대전] 은 정의가 없는 대괄호라 그대로다.",
            "",
            "[mode]: https://e.x/멀티",
            "[파티]: https://e.x/멀티",
          ].join("\n"),
        },
      ],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.line, hit.column, hit.word])).toEqual([
      [1, 2, "파티 모드"],
      [2, 2, "파티 모드"],
      [3, 2, "파티 모드"],
    ]);
  });

  it("인용 블록 안의 한 문단도 줄바꿈을 이어 맞춰 보고, 빈 인용 줄이나 빈 줄에서 끊는다", () => {
    const hits = findAvoidedWords({
      glossary: `**대전 모드 (Versus Mode)**:\n여러 명이 하는 게임.\n_Avoid_: 파티 모드\n`,
      docs: [
        {
          path: "docs/specs/a.md",
          text: [
            "> 대전은 파티", // 1: 다음 인용 줄과 한 문단
            "> 모드로 한다.",
            "> 파티", // 3: 빈 인용 줄 너머
            ">",
            "> 모드",
            "",
            "> 파티", // 7: 빈 줄 너머의 인용 밖 줄
            "",
            "모드",
          ].join("\n"),
        },
      ],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.line, hit.column, hit.word])).toEqual([[1, 7, "파티 모드"]]);
  });

  it("코드 블록은 연 표시와 같은 글자로, 같거나 더 긴 줄이 나와야 닫힌다", () => {
    const hits = findAvoidedWords({
      glossary: `**대전 모드 (Versus Mode)**:\n여러 명이 하는 게임.\n_Avoid_: 파티 모드\n`,
      docs: [
        {
          path: "docs/specs/a.md",
          text: [
            "````md",
            "```", // 더 짧아서 닫지 않는다
            "파티",
            "모드",
            "````",
            "~~~",
            "```", // 다른 글자라 닫지 않는다
            "파티",
            "모드",
            "~~~~",
            "대전은 파티", // 11: 코드 블록이 다 닫힌 뒤의 문단
            "모드로 한다.",
          ].join("\n"),
        },
      ],
      allowlist: [],
    });

    expect(hits.map((hit) => [hit.line, hit.column, hit.word])).toEqual([[11, 5, "파티 모드"]]);
  });

  describe("마크다운 구조", () => {
    const glossary = `**대전 모드 (Versus Mode)**:\n여러 명이 하는 게임.\n_Avoid_: 파티 모드\n`;
    const check = (text: string) =>
      findAvoidedWords({ glossary, docs: [{ path: "docs/specs/a.md", text }], allowlist: [] }).map(
        (hit) => [hit.line, hit.column, hit.word],
      );

    it("링크 주소에 괄호 짝이 있어도 링크 글자 뒤의 말과 이어 맞춰 본다", () => {
      expect(check("[파티](https://e.x/a_(b)) 모드는 없다.")).toEqual([[1, 2, "파티 모드"]]);
    });

    it("인용 블록 안의 코드 블록은 보지 않고, 그 뒤 인용 문단은 본다", () => {
      expect(
        check(
          ["> ```", "> 파티", "> 모드", "> ```", ">", "> 대전은 파티", "> 모드로 한다."].join("\n"),
        ),
      ).toEqual([[6, 7, "파티 모드"]]);
    });

    it("가로줄(***, ___)을 사이에 둔 줄은 잇지 않는다", () => {
      expect(check(["파티", "***", "모드", "", "파티", "___", "모드"].join("\n"))).toEqual([]);
    });

    it("인용 깊이가 다른 줄은 잇지 않는다", () => {
      expect(check(["> 파티", ">> 모드"].join("\n"))).toEqual([]);
    });

    it("<br> 로 나눈 말은 띄어쓴 것으로 보고 맞춰 본다", () => {
      expect(check("파티<br>모드, 파티<BR/>모드, 파티<br />모드")).toEqual([
        [1, 1, "파티 모드"],
        [1, 11, "파티 모드"],
        [1, 22, "파티 모드"],
      ]);
    });

    it("맨 앞의 YAML 머리말은 보지 않고, 그 뒤 본문은 원래 줄 번호로 보고한다", () => {
      expect(
        check(["---", "title: 파티 모드", "---", "", "대전은 파티 모드다."].join("\n")),
      ).toEqual([[5, 5, "파티 모드"]]);
    });
  });

  it("허용 구절은 어절 첫머리에서 시작할 때만 허용한다(뒤에 조사는 붙어도 된다)", () => {
    const hits = findAvoidedWords({
      glossary: `**굴림 연출 (Roll Animation)**:\n정해진 결과를 보여 주는 것.\n_Avoid_: 시뮬레이션\n`,
      docs: [
        {
          path: "docs/adr/0001.md",
          text: ["비물리 시뮬레이션을 돌린다.", "(물리 시뮬레이션이) 정한다."].join("\n\n"),
        },
      ],
      allowlist: [{ word: "시뮬레이션", phrase: "물리 시뮬레이션", reason: "물리 엔진의 계산" }],
    });

    expect(hits.map((hit) => [hit.line, hit.column, hit.word])).toEqual([[1, 5, "시뮬레이션"]]);
  });
});
