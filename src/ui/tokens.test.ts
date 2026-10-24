import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

/** src/ui/tokens.css 의 :root 에서 `--이름: #hex;` 를 읽는다. 색 토큰은 이 파일 한 곳에만 있다. */
function readTokens(): Record<string, string> {
  const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
  const tokens: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

describe("대비 계산", () => {
  it("WCAG 대비를 알려진 값과 같게 잰다", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // #777777 은 흰 바탕에서 4.48:1 로 4.5 에 조금 못 미치는 것으로 널리 알려진 값이다.
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#777777")).toBeCloseTo(4.48, 2);
  });
});

/**
 * 스펙 「플레이어 색과 차례 강조」: 점수 미리보기와 기록한 점수의 글자는 노란 강조 위와 점수표의 기본 바탕
 * 위에서 모두 4.5:1 이상. 고른 칸(주황)과 성립 알림 칸에도 숫자가 보이므로 함께 잰다.
 * 표의 짝은 tokens.css·app.css 가 실제로 쓰는 글자색과 바탕색의 짝이다.
 */
describe("점수표 글자 대비 (토큰 값으로)", () => {
  const tokens = readTokens();
  const pairs: [string, string, string][] = [
    ["점수 미리보기 · 기본 칸", "--preview", "--cell"],
    ["점수 미리보기 · 지금 차례 세로줄", "--preview", "--turn"],
    ["기록한 점수 · 기본 칸", "--text", "--cell"],
    ["기록한 점수 · 지금 차례 세로줄", "--text", "--turn"],
    ["고른 칸의 미리보기", "--text", "--sel-cell"],
    ["성립 알림 칸의 미리보기", "--text", "--callout-cell"],
    ["요트 성립 알림 칸의 미리보기", "--text", "--yacht"],
    ["소계·보너스 줄", "--on-band", "--band-soft"],
    ["머리줄·총합 득점 줄", "--on-band", "--band"],
  ];

  it.each(pairs)("%s: 4.5:1 이상", (_, text, background) => {
    const fg = tokens[text];
    const bg = tokens[background];
    expect(fg, `${text} 토큰이 없다`).toBeDefined();
    expect(bg, `${background} 토큰이 없다`).toBeDefined();
    expect(contrastRatio(fg ?? "", bg ?? "")).toBeGreaterThanOrEqual(4.5);
  });

  it("차례 세로줄·기본 칸·고른 칸은 원작 색(#fee267·#fffbef·#ff7a3d)이다", () => {
    expect(tokens["--turn"]?.toLowerCase()).toBe("#fee267");
    expect(tokens["--cell"]?.toLowerCase()).toBe("#fffbef");
    expect(tokens["--sel-cell"]?.toLowerCase()).toBe("#ff7a3d");
  });
});
