import type { DieValue } from "../engine/types";
import { BOARD, columnX, type Vec3 } from "./board";

export interface RestInput {
  value: DieValue;
  held: boolean;
  column: number;
}

export interface Pose {
  position: Vec3;
  /** three.js 오일러 각(XYZ 순서, 라디안). y 회전은 쓰지 않는다. */
  rotation: Vec3;
}

/**
 * 주사위 모델의 면 배치. three.js 상자 면 순서(+x, -x, +y, -y, +z, -z)의 눈.
 * 마주 보는 면의 합이 7 이다.
 */
export const FACE_VALUES: readonly DieValue[] = [2, 5, 1, 6, 3, 4];

/** FACE_VALUES 면 배치에서 각 눈이 위(+y)를 향하게 하는 회전. */
const UP_ROTATION: Record<DieValue, Vec3> = {
  1: [0, 0, 0],
  6: [Math.PI, 0, 0],
  2: [0, 0, Math.PI / 2],
  5: [0, 0, -Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
};

/** 정렬이 끝난 주사위가 놓이는 자리와 자세. 홀드 여부로 줄을, 열로 가로 위치를 정한다. */
export function restPose({ value, held, column }: RestInput): Pose {
  return {
    position: [columnX(column), BOARD.die / 2, held ? BOARD.holdRowZ : BOARD.lineupZ],
    rotation: UP_ROTATION[value],
  };
}
