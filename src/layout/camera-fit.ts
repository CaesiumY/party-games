import { PerspectiveCamera, Vector3 } from "three";
import { boardCorners, cupCorners, holdRowCorners, lineupCorners, type Vec3 } from "./board";

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
  /**
   * 판 영역 위에 겹친 버튼 같은 것의 자리. 컵과 주사위(정렬 줄·홀드 자리)는 언제나 여기를 피한다.
   * 판 전체(테두리 포함)도 피하게 하되, 그러느라 판이 많이 작아지면 판 앞쪽 테두리·펠트는 덮이게 둔다.
   */
  avoid: Rect[];
}

export interface CameraFit {
  fov: number;
  position: Vec3;
  target: Vec3;
  /**
   * 카메라 aspect 와 setViewOffset 에 그대로 넣을 값. 위쪽 표시 자리만큼 판을 아래로 옮긴다.
   * `shiftY` 는 겹친 것을 피하려고 판을 더 옮긴 거리(px, 양수면 아래로). 크기는 바뀌지 않는다.
   */
  aspect: number;
  view: { fullWidth: number; fullHeight: number; width: number; height: number; shiftY: number };
}

/** 비스듬히 내려다보는 방향과 화각. 시안 v6 에서 고른 값. */
const FOV = 36;
const TARGET: Vec3 = [0, 0, 0.45];
const DIRECTION = new Vector3(0, 11.5, 8.2 - TARGET[2]).normalize();
/** 판 영역 가장자리와 판 사이 여백(px). */
const MARGIN = 6;

/**
 * 판 전체가 겹친 것들을 피하느라 카메라가 이 배수보다 더 멀어지면(판이 10% 넘게 작아지면) 판 전체 대신
 * 컵·주사위 자리만 피한다. 세로 배치의 버튼은 판 앞쪽 테두리 위에 놓여서, 판 전체가 피하면 판이 약 20%
 * 줄고 홀드 말풍선이 들어가지 않는다. 그래서 버튼이 앞쪽 테두리·펠트는 덮게 둔다(2026-10-19 사용자 결정).
 * 가로 배치의 지금 차례 표시는 판 전체가 피해도 판이 거의 줄지 않아 피한다.
 */
const WHOLE_BOARD_SLACK = 1.1;

/** 겹친 것들을 피해야 하는 것: 판 전체(테두리 높이와 컵 포함) 하나, 또는 컵·정렬 줄·홀드 자리 각각. */
const WHOLE_BOARD = [[...boardCorners(), ...cupCorners()]];
const PLAY_AREA = [cupCorners(), lineupCorners(), holdRowCorners()];

/**
 * 판을 되도록 크게 그리는 거리와 위치를 찾는다. 판 전체가 겹친 것들을 피하는 맞춤이 판을 거의 줄이지
 * 않으면 그것을, 아니면 컵·주사위 자리만 피하는 맞춤을 쓴다. 어느 쪽이든 판 전체는 판 영역 안에 든다.
 */
export function fitCamera(input: FitInput): CameraFit {
  const whole = search(input, WHOLE_BOARD);
  if (input.avoid.length === 0) return whole.fit;
  const play = search(input, PLAY_AREA);
  return whole.distance <= play.distance * WHOLE_BOARD_SLACK ? whole.fit : play.fit;
}

/**
 * 들어가는 가장 가까운 거리(판이 가장 크게 보이는 거리)를 찾는다. 거리마다 판을 위아래로 옮겨 볼 수
 * 있으면(`placeAt`) 들어간 것으로 친다. 판 영역에 들어가는 것만 보면 멀수록 잘 들어가지만, 겹친 것을
 * 피하는 것은 그렇지 않다(판이 작아지면 오른쪽의 컵이 가운데로 와서 왼쪽 버튼과 겹치기 시작한다).
 * 그래서 판 영역에 들어가는 가장 가까운 거리부터 조금씩 멀리 가며 처음 들어가는 거리를 찾는다.
 */
function search(input: FitInput, guarded: readonly Vec3[][]): { distance: number; fit: CameraFit } {
  const place = (distance: number) => placeAt(input, distance, guarded);
  const far = 400;
  const fitsArea = (distance: number) => placeAt(input, distance, []) !== null;
  if (place(far) === null) return { distance: far, fit: buildFit(input, far, 0) };
  let near = bisect(2, far, fitsArea);
  let next = near;
  while (place(next) === null) {
    near = next;
    next = Math.min(far, next * 1.01);
  }
  const distance = next === near ? next : bisect(near, next, (d) => place(d) !== null);
  return { distance, fit: buildFit(input, distance, place(distance) ?? 0) };
}

/** `fits(near)` 는 거짓, `fits(far)` 는 참이라 치고, 그 사이에서 참이 되는 가장 가까운 거리를 좁힌다. */
function bisect(near: number, far: number, fits: (distance: number) => boolean): number {
  let [lo, hi] = [near, far];
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

function buildFit(input: FitInput, distance: number, shiftY: number): CameraFit {
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
    view: { fullWidth: input.width, fullHeight, width: input.width, height: input.height, shiftY },
  };
}

/**
 * 이 거리에서 판 전체(테두리 높이와 컵 포함)가 판 영역 안, 위쪽 표시 자리 아래에 들고, `guarded` 의
 * 상자들이 겹친 것들의 자리와 겹치지 않게 하는 위아래 이동(px). 0 에 가장 가까운 값을 고르고, 없으면 null.
 * 이동은 화면에서 그대로 평행 이동이라(크기는 그대로) 옮기기 전 자리 하나로 계산한다.
 */
function placeAt(input: FitInput, distance: number, guarded: readonly Vec3[][]): number | null {
  const fit = buildFit(input, distance, 0);
  const box = boundsOf(projectPoints(fit, [...boardCorners(), ...cupCorners()]));
  if (box.left < MARGIN || box.right > input.width - MARGIN) return null;
  const low = input.reserveTop + MARGIN - box.top;
  const high = input.height - MARGIN - box.bottom;
  if (low > high) return null;
  // 지킬 상자와 가로로 겹치는 것마다, 그 상자가 위로도 아래로도 비켜나지 못하는 이동 구간(양 끝은 허용).
  const blocked = guarded
    .map((points) => boundsOf(projectPoints(fit, points)))
    .flatMap((g) =>
      input.avoid
        .filter((rect) => g.left < rect.right && rect.left < g.right)
        .map((rect) => ({ from: rect.top - MARGIN - g.bottom, to: rect.bottom + MARGIN - g.top })),
    );
  const candidates = [Math.min(high, Math.max(low, 0)), ...blocked.flatMap((b) => [b.from, b.to])]
    .filter((dy) => dy >= low && dy <= high)
    .filter((dy) => blocked.every((b) => dy <= b.from || dy >= b.to));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, dy) => (Math.abs(dy) < Math.abs(best) ? dy : best));
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
  const { fullWidth, fullHeight, width, height, shiftY } = fit.view;
  camera.setViewOffset(fullWidth, fullHeight, 0, -shiftY, width, height);
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
