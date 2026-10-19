import { describe, expect, it } from "vitest";
import { overlayReserve } from "./overlay-reserve";

describe("판 위에 겹친 것들의 자리", () => {
  it("맨 위에 붙은 표시는 위쪽 자리로, 아래쪽 버튼은 피할 자리로 나눈다", () => {
    const rollsLeft = { left: 250, top: 10, right: 330, bottom: 34 };
    const currentPlayer = { left: 12, top: 10, right: 110, bottom: 38 };
    const buttons = { left: 10, top: 250, right: 210, bottom: 290 };

    expect(overlayReserve([rollsLeft, currentPlayer, buttons])).toEqual({
      reserveTop: 38,
      avoid: [buttons],
    });
  });

  it("보이지 않는(크기 0) 것은 무시한다", () => {
    expect(overlayReserve([{ left: 0, top: 0, right: 0, bottom: 0 }])).toEqual({
      reserveTop: 0,
      avoid: [],
    });
  });
});
