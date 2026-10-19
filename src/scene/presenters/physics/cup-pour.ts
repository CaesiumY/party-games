import { Quaternion, Vector3 } from "three";
import { BOARD, type Vec3 } from "../../../layout/board";

/**
 * 컵을 쏟는 모양(스펙 「굴림 연출」 1단계). 컵은 판 오른쪽 아래에서 판 가운데 쪽으로 옆으로 눕는다.
 * 미리 굴리기는 누운 컵의 입구에서 주사위를 던지고, 화면의 컵도 같은 값으로 눕는다.
 * 원점은 판 가운데, 컵의 기준점은 바닥 원의 가운데다.
 */

/** 쏟는 방향(수평 단위 벡터). 컵에서 판 가운데 쪽. */
export const POUR_DIRECTION: Vec3 = [-0.6, 0, -0.8];

/** 다 쏟았을 때 기울어진 각(라디안). 입구 테두리가 바닥에 닿지 않을 만큼만 눕힌다. */
export const POUR_TILT = (78 / 180) * Math.PI;

const UP = new Vector3(0, 1, 0);
const direction = new Vector3(...POUR_DIRECTION);
/** 기울이는 축. 이 축으로 돌리면 컵 입구가 쏟는 방향으로 넘어간다. */
const TILT_AXIS = new Vector3().crossVectors(UP, direction).normalize();
/** 기울일 때 컵이 짚는 점: 쏟는 쪽 바닥 테두리. */
const PIVOT = new Vector3(BOARD.cup.x, 0, BOARD.cup.z).addScaledVector(
  direction,
  BOARD.cup.bottomRadius,
);

export interface CupPose {
  /** 컵 기준점(바닥 원의 가운데)의 위치. */
  position: Vec3;
  quaternion: Quaternion;
}

/**
 * 컵의 자세. `tilt` 만큼 쏟는 쪽으로 눕히고(쏟는 쪽 바닥 테두리를 짚고 돈다),
 * 그 위에 흔들기(`wobble`: 기울이는 축과 쏟는 방향 축으로 도는 각, `lift`: 들어 올린 높이)를 더한다.
 */
export function cupPose(tilt: number, wobble: { forward: number; side: number; lift: number }) {
  const rotation = new Quaternion()
    .setFromAxisAngle(direction, wobble.side)
    .multiply(new Quaternion().setFromAxisAngle(TILT_AXIS, tilt + wobble.forward));
  const base = new Vector3(BOARD.cup.x, 0, BOARD.cup.z)
    .sub(PIVOT)
    .applyQuaternion(rotation)
    .add(PIVOT);
  base.y += wobble.lift;
  return { position: [base.x, base.y, base.z] as Vec3, quaternion: rotation };
}

/** 다 쏟았을 때 컵 입구 원의 가운데. */
export function pourMouth(): Vec3 {
  const { position, quaternion } = cupPose(POUR_TILT, { forward: 0, side: 0, lift: 0 });
  const axis = UP.clone().applyQuaternion(quaternion);
  return [
    position[0] + axis.x * BOARD.cup.height,
    position[1] + axis.y * BOARD.cup.height,
    position[2] + axis.z * BOARD.cup.height,
  ];
}

/**
 * 누운 컵 입구 안팎에서 주사위가 처음 놓이는 자리(굴리는 순서대로 최대 다섯).
 * 입구 쪽 두 개, 컵 안쪽 두 개, 그 위 한 개. 처음부터 서로 겹치지 않을 만큼 띄운다.
 * 값은 [쏟는 방향으로의 거리(입구 기준), 옆으로의 거리, 높이].
 */
const START_OFFSETS: readonly Vec3[] = [
  [0.2, -0.42, 0.5],
  [0.2, 0.42, 0.5],
  [-0.55, -0.42, 0.78],
  [-0.55, 0.42, 0.78],
  [-0.15, 0, 1.4],
];

export function pourStart(index: number): Vec3 {
  const [along, side, height] = START_OFFSETS[index % START_OFFSETS.length] ?? [0, 0, 0.5];
  const mouth = pourMouth();
  return [
    mouth[0] + direction.x * along + TILT_AXIS.x * side,
    height,
    mouth[2] + direction.z * along + TILT_AXIS.z * side,
  ];
}

/** 쏟는 방향과 그 옆 방향(수평 단위 벡터). 던지는 속도를 정할 때 쓴다. */
export function pourAxes(): { forward: Vec3; side: Vec3 } {
  return {
    forward: POUR_DIRECTION,
    side: [TILT_AXIS.x, TILT_AXIS.y, TILT_AXIS.z],
  };
}
