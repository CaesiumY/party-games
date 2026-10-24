import { type Quaternion, Vector3 } from "three";
import type { DieValue } from "../../../engine/types";
import { FACE_VALUES } from "../../../layout/placement";

/**
 * 테스트 전용 도우미: 주사위 모델을 자세 `q` 로 놓았을 때 화면에서 위를 향해 보이는 눈.
 * 모델의 면 순서(three.js 상자 재질 순서 +x, -x, +y, -y, +z, -z)와 FACE_VALUES 만으로 정한다.
 * 연출 코드는 이것을 쓰지 않는다. 멈춘 면을 읽어 점수에 쓰는 일은 없다(ADR-0001).
 */
const BOX_FACE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];

export function visibleTop(q: Quaternion): { value: DieValue; tilt: number } {
  let best = 0;
  let bestUp = -2;
  BOX_FACE_NORMALS.forEach((normal, i) => {
    const up = normal.clone().applyQuaternion(q).y;
    if (up > bestUp) {
      bestUp = up;
      best = i;
    }
  });
  return { value: FACE_VALUES[best] as DieValue, tilt: bestUp };
}
