import { BOARD, holdRowCorners } from "./board";
import { type CameraFit, projectPoints } from "./camera-fit";

/** 홀드 자리 주사위의 아래 끝과 알림 글자 윗변 사이(px). */
const GAP = 4;

/**
 * 성립 알림의 자리(스펙 「굴림 연출」 성립 알림, DESIGN.md 결정 기록). 3D 를 그리지 않는 계산이다.
 * 원작처럼 판 위쪽 가운데, 홀드 자리 줄 바로 아래의 펠트 위에 띄운다. 홀드한 주사위를 가리지 않도록
 * 홀드 자리 주사위가 화면에 그려지는 아래 끝보다 조금 아래에 글자 윗변을 둔다.
 * 돌려주는 값은 판 영역 왼쪽 위 기준 px 이고, `x` 는 글자의 가로 가운데, `y` 는 글자 상자의 윗변이다.
 */
export function calloutAnchor(fit: CameraFit): { x: number; y: number } {
  const held = projectPoints(fit, holdRowCorners());
  const bottom = Math.max(...held.map((p) => p.y));
  const [center] = projectPoints(fit, [[0, 0, BOARD.holdRowZ]]);
  return { x: center?.x ?? fit.view.fullWidth / 2, y: bottom + GAP };
}
