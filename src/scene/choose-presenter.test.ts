import { describe, expect, it } from "vitest";
import { choosePresenter } from "./choose-presenter";

const presenters = { instant: "순간 배치", animated: "물리 연출" };

describe("연출 구현 고르기", () => {
  it("'동작 줄이기'가 켜져 있으면 어떤 연출 구현이 있어도 순간 배치를 쓴다", () => {
    expect(choosePresenter(true, presenters)).toBe("순간 배치");
  });

  it("'동작 줄이기'가 꺼져 있으면 연출 구현을 쓴다", () => {
    expect(choosePresenter(false, presenters)).toBe("물리 연출");
  });
});
