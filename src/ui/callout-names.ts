import type { Category } from "../engine/types";

/**
 * 성립 알림에 크게 띄우는 영문 글자(DESIGN.md 결정 기록 2026-10-25, 시안 B「영문 아케이드」).
 * 원작 영문판의 이름은 확인하지 못해, 한국어판 이름을 그대로 영문으로 옮겨 적었다. 꾸밈이라 화면 낭독기는
 * 한국어 이름(아래 이름표)만 읽는다. 요트는 글자 대신 그림(`CALLOUT_YACHT_IMAGE`)을 쓴다.
 */
export const CALLOUT_EN: Partial<Record<Category, string>> = {
  fourDice: "FOUR DICE",
  fullHouse: "FULL HOUSE",
  sStraight: "S. STRAIGHT",
  lStraight: "L. STRAIGHT",
};

/** 요트 성립 알림 그림(Codex CLI 이미지 생성, 560×154, 투명 바탕). */
export const CALLOUT_YACHT_IMAGE = {
  src: "/img/callout-yacht.webp",
  width: 560,
  height: 154,
} as const;
