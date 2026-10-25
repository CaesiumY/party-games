import { UPPER_BONUS_POINTS, UPPER_BONUS_THRESHOLD } from "../engine/totals";
import type { Category } from "../engine/types";

/**
 * 족보 탭의 조건 설명. 원작의 족보 설명 말풍선 문구를 따른다(조사 보고서 4.6).
 * 원작에서 읽은 것은 에이스·초이스·풀 하우스·S. 스트레이트·요트 다섯 개이고, 나머지는 같은 꼴로 지었다.
 * `note` 는 원작에 없는 덧붙임이다(점수 셈법, 풀 하우스의 같은 눈 5개 인정).
 */
export const RULE_TEXT: Record<Category, { description: string; note?: string }> = {
  aces: { description: "주사위 눈 1의 합계" },
  deuces: { description: "주사위 눈 2의 합계" },
  treys: { description: "주사위 눈 3의 합계" },
  fours: { description: "주사위 눈 4의 합계" },
  fives: { description: "주사위 눈 5의 합계" },
  sixes: { description: "주사위 눈 6의 합계" },
  choice: { description: "모든 주사위 눈의 합계" },
  fourDice: { description: "같은 주사위 눈 4개", note: "점수는 모든 주사위 눈의 합계" },
  fullHouse: {
    description: "같은 주사위 눈 3개+같은 주사위 눈 2개",
    note: "같은 주사위 눈 5개도 인정 · 점수는 모든 주사위 눈의 합계",
  },
  sStraight: { description: "4개 이어진 주사위 눈", note: "점수는 늘 15점" },
  lStraight: { description: "5개 이어진 주사위 눈", note: "점수는 늘 30점" },
  yacht: { description: "같은 주사위 눈 5개", note: "점수는 늘 50점" },
};

/** 족보 탭 끝의 윗칸 보너스 줄. 이름은 점수표의 보너스 줄과 같고, 설명은 원작 보너스 안내 문구다. */
export const BONUS_TEXT = {
  name: `보너스+${UPPER_BONUS_POINTS}`,
  description: `1~6 눈 합계가 ${UPPER_BONUS_THRESHOLD}점 이상이면 보너스`,
};

export interface Section {
  title: string;
  lines: readonly string[];
}

/**
 * 플레이 방법 탭. 소제목 「기본 규칙」·「다시 던지기는 2번까지!」는 원작 규칙 화면의 쪽 제목이다.
 * 탭 이름 「족보」는 원작을 따르지만, 본문 문장은 용어집대로 「카테고리」라고 쓴다(힌트 탭도 같다).
 */
export const PLAY_SECTIONS: readonly Section[] = [
  {
    title: "기본 규칙",
    lines: [
      "주사위 5개를 던져 나온 눈으로, 점수표의 카테고리 하나에 점수를 기록해요.",
      "한 사람에 12턴, 12개 카테고리를 다 채우면 게임이 끝나요. 총합 득점이 높은 사람이 이겨요.",
    ],
  },
  {
    title: "다시 던지기는 2번까지!",
    lines: [
      "한 턴에 「주사위 던지기」 1번과 「다시 던지기」 2번, 최대 3번 던질 수 있어요.",
      "남기고 싶은 주사위는 「킵」을 눌러 위로 올려 두세요. 다시 던져도 그대로 남아요. 「되돌리기」를 누르면 다시 내려와요.",
    ],
  },
  {
    title: "기록하기",
    lines: [
      "주사위를 던지면 점수표의 빈 카테고리마다 받을 점수가 흐리게 보여요.",
      "카테고리를 누르면 선택되고, 그 점수에 보태는 주사위가 빛나요. 「기록」을 누르면 점수가 적히고 다음 차례로 넘어가요.",
      "3번을 다 던지지 않아도 언제든 기록할 수 있어요.",
      "조건이 맞지 않는 카테고리에 기록하면 0점이에요. 버튼도 「0점으로 기록」으로 바뀌어요.",
    ],
  },
];

/** 힌트 탭. 원작 힌트 문구는 확인하지 못해 이 앱이 쓴다(조사 보고서 6절). */
export const HINT_SECTIONS: readonly Section[] = [
  {
    title: "보너스를 노려요",
    lines: [
      `에이스부터 식스까지 각 눈을 3개씩 모으면 딱 ${UPPER_BONUS_THRESHOLD}점이라 보너스 ${UPPER_BONUS_POINTS}점을 받아요.`,
      "큰 눈(5·6)을 4개 이상 모으면 작은 눈에서 조금 모자라도 채울 수 있어요.",
    ],
  },
  {
    title: "요트는 50점",
    lines: ["같은 눈이 3~4개 나오면 나머지를 다시 던져 요트를 노려 보세요. 한 번에 50점이에요."],
  },
  {
    title: "0점으로 기록할 때",
    lines: [
      "마땅한 카테고리가 없는 턴에는 채우기 어려운 카테고리(요트, 에이스 같은)에 0점을 기록해 다른 카테고리를 아껴 두는 것도 방법이에요.",
      "초이스는 어떤 주사위든 받아 주니 마지막 보험으로 남겨 두면 좋아요.",
    ],
  },
];
