import { describe, expect, it } from "vitest";
import { BOARD, columnX } from "./board";
import { restPose } from "./placement";

describe("주사위가 놓이는 자리", () => {
  it("홀드하지 않은 주사위는 자기 열의 정렬 줄에, 홀드한 주사위는 같은 열의 홀드 자리에 놓인다", () => {
    const free = restPose({ value: 3, held: false, column: 1 });
    const held = restPose({ value: 3, held: true, column: 1 });

    expect(free.position).toEqual([columnX(1), BOARD.die / 2, BOARD.lineupZ]);
    expect(held.position).toEqual([columnX(1), BOARD.die / 2, BOARD.holdRowZ]);
  });

  it.each([1, 2, 3, 4, 5, 6] as const)("눈 %i 이 위를 향하는 자세다", (value) => {
    const { rotation } = restPose({ value, held: false, column: 0 });

    expect(topFace(rotation)).toBe(value);
  });
});

// 주사위 모델의 면 배치(src/scene/die-faces.ts 와 같다): +x 2, -x 5, +y 1, -y 6, +z 3, -z 4.
// 회전을 적용했을 때 위(+y)를 향하는 면을 직접 계산한다.
function topFace([rx, , rz]: readonly [number, number, number]): number {
  const faces: [number, [number, number, number]][] = [
    [2, [1, 0, 0]],
    [5, [-1, 0, 0]],
    [1, [0, 1, 0]],
    [6, [0, -1, 0]],
    [3, [0, 0, 1]],
    [4, [0, 0, -1]],
  ];
  // XYZ 오일러: 점에 Z, Y, X 순서가 아니라 행렬 Rx·Ry·Rz 를 곱한다(three.js 기본 순서 'XYZ').
  const rotate = ([x, y, z]: [number, number, number]): [number, number, number] => {
    const [x1, y1] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    const z1 = z;
    return [x1, y1 * Math.cos(rx) - z1 * Math.sin(rx), y1 * Math.sin(rx) + z1 * Math.cos(rx)];
  };
  const up = faces.find(([, normal]) => rotate(normal)[1] > 0.99);
  return up?.[0] ?? -1;
}
