import { describe, expect, it } from "vitest";
import type { Die, DieValue } from "../engine/types";
import { lineupColumns } from "./columns";

const dice = (values: DieValue[]): Die[] =>
  values.map((value, i) => ({ id: i as Die["id"], value, held: false }));

describe("정렬 줄의 열", () => {
  it("굴림이 끝나면 눈 오름차순으로 왼쪽 열부터 놓인다", () => {
    // 주사위 0..4 의 눈이 5,1,4,1,3 이면 열은 1·1·3·4·5 순서가 된다.
    expect(lineupColumns(dice([5, 1, 4, 1, 3]))).toEqual([4, 0, 3, 1, 2]);
  });
});
