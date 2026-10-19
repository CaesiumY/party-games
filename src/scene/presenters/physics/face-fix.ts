import { Quaternion, Vector3 } from "three";
import type { DieValue } from "../../../engine/types";
import { FACE_VALUES } from "../../../layout/placement";

/** 주사위 모델의 로컬 면 법선. three.js 상자 재질 순서(+x, -x, +y, -y, +z, -z)라 FACE_VALUES 와 짝이다. */
const FACE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
] as const;

const WORLD_UP = new Vector3(0, 1, 0);

/** 자세 `q` 에서 가장 위를 향한 로컬 면 법선. 면 맞추기에만 쓴다(점수에는 쓰지 않는다, ADR-0001). */
function upwardNormal(q: Quaternion): Vector3 {
  const upInLocal = WORLD_UP.clone().applyQuaternion(q.clone().invert());
  let best: Vector3 = FACE_NORMALS[2];
  let bestDot = Number.NEGATIVE_INFINITY;
  for (const normal of FACE_NORMALS) {
    const dot = normal.dot(upInLocal);
    if (dot > bestDot) {
      bestDot = dot;
      best = normal;
    }
  }
  return best;
}

/**
 * 면 맞추기(스펙 「굴림 연출」 2단계). 미리 굴린 주사위가 자세 `rest` 로 멈췄을 때 `value` 의 면이 위로 보이도록,
 * 모델에 먼저 적용할 고정 회전을 돌려준다. 화면 자세는 매 프레임 `기록한 자세 · 이 회전` 이다.
 *
 * 돌려주는 회전은 언제나 정육면체를 제자리에 겹치는 회전(24개 중 하나)이라, 보이는 모델이 물리 몸체와
 * 같은 부피를 차지한다. `quarter`(0~3)는 같은 눈이 위인 네 방향 중 하나를 고른다.
 */
export function faceFix(value: DieValue, rest: Quaternion, quarter: number): Quaternion {
  const valueNormal = FACE_NORMALS[FACE_VALUES.indexOf(value)] ?? FACE_NORMALS[2];
  const up = upwardNormal(rest);
  const turn = new Quaternion().setFromUnitVectors(valueNormal, up);
  const spin = new Quaternion().setFromAxisAngle(up, (Math.PI / 2) * (quarter % 4));
  return spin.multiply(turn);
}
