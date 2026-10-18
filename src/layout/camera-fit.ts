import { PerspectiveCamera, Vector3 } from "three";
import { boardCorners, cupCorners, lineupCorners, type Vec3 } from "./board";

/**
 * 고정 카메라의 거리 맞춤(스펙 「화면 배치」). 3D 를 그리지 않는 계산이다.
 * three.js 의 카메라 수학만 쓰고 WebGL·DOM 은 쓰지 않는다.
 */

/** 판 영역 안의 사각형(px, 판 영역 왼쪽 위가 원점). */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FitInput {
  /** 판 영역 크기(px). */
  width: number;
  height: number;
  /** 판 영역 위쪽에 겹친 표시(남은 굴림·지금 차례)가 차지한 높이(px). 판은 이 아래에 그린다. */
  reserveTop: number;
  /** 판 영역 위에 겹친 버튼 같은 것의 자리. 컵과 정렬 줄의 주사위가 여기에 들어가지 않게 한다. */
  avoid: Rect[];
}

export interface CameraFit {
  fov: number;
  position: Vec3;
  target: Vec3;
  /** 카메라 aspect 와 setViewOffset 에 그대로 넣을 값. 위쪽 표시 자리만큼 판을 아래로 옮긴다. */
  aspect: number;
  view: { fullWidth: number; fullHeight: number; width: number; height: number };
}

/** 비스듬히 내려다보는 방향과 화각. 시안 v6 에서 고른 값. */
const FOV = 36;
const TARGET: Vec3 = [0, 0, 0.45];
const DIRECTION = new Vector3(0, 11.5, 8.2 - TARGET[2]).normalize();
/** 판 영역 가장자리와 판 사이 여백(px). */
const MARGIN = 6;

export function fitCamera(input: FitInput): CameraFit {
  const fits = (distance: number) => satisfies(input, buildFit(input, distance));
  let near = 2;
  let far = 400;
  if (!fits(far)) return buildFit(input, far);
  for (let i = 0; i < 40; i += 1) {
    const mid = (near + far) / 2;
    if (fits(mid)) far = mid;
    else near = mid;
  }
  return buildFit(input, far);
}

function buildFit(input: FitInput, distance: number): CameraFit {
  const reserve = Math.min(input.reserveTop, input.height * 0.5);
  const fullHeight = input.height + reserve;
  const position = DIRECTION.clone()
    .multiplyScalar(distance)
    .add(new Vector3(...TARGET));
  return {
    fov: FOV,
    position: [position.x, position.y, position.z],
    target: TARGET,
    aspect: input.width / fullHeight,
    view: { fullWidth: input.width, fullHeight, width: input.width, height: input.height },
  };
}

function satisfies(input: FitInput, fit: CameraFit): boolean {
  const inside = projectPoints(fit, [...boardCorners(), ...cupCorners()]).every(
    (p) =>
      p.x >= MARGIN &&
      p.x <= input.width - MARGIN &&
      p.y >= input.reserveTop + MARGIN &&
      p.y <= input.height - MARGIN,
  );
  if (!inside) return false;
  const guarded = [
    boundsOf(projectPoints(fit, cupCorners())),
    boundsOf(projectPoints(fit, lineupCorners())),
  ];
  return input.avoid.every((rect) => guarded.every((box) => !overlaps(box, rect)));
}

/** 맞춘 값으로 three.js 카메라를 만든다. 장면도 이것을 쓴다. */
export function makeCamera(fit: CameraFit): PerspectiveCamera {
  const camera = new PerspectiveCamera(fit.fov, fit.aspect, 0.1, 1000);
  applyFit(camera, fit);
  return camera;
}

/** 이미 있는 카메라에 맞춘 값을 넣는다. */
export function applyFit(camera: PerspectiveCamera, fit: CameraFit): void {
  camera.fov = fit.fov;
  camera.aspect = fit.aspect;
  camera.position.set(...fit.position);
  camera.lookAt(new Vector3(...fit.target));
  const { fullWidth, fullHeight, width, height } = fit.view;
  camera.setViewOffset(fullWidth, fullHeight, 0, 0, width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** 월드 좌표의 점들을 판 영역의 px 좌표로 투영한다. */
export function projectPoints(fit: CameraFit, points: readonly Vec3[]): { x: number; y: number }[] {
  const camera = makeCamera(fit);
  const { width, height } = fit.view;
  return points.map((point) => {
    const p = new Vector3(...point).project(camera);
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
  });
}

function boundsOf(points: { x: number; y: number }[]): Rect {
  return {
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    bottom: Math.max(...points.map((p) => p.y)),
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
