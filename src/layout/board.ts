/**
 * 3D 판의 크기와 자리(월드 좌표, 단위는 three.js 단위). 장면(src/scene)과 카메라 맞춤이 함께 쓴다.
 * x 는 오른쪽, z 는 화면 앞쪽(아래), y 는 위. 판 가운데가 원점이다.
 */
export const BOARD = {
  /** 펠트 바닥의 가로·세로. */
  width: 6.2,
  depth: 8.4,
  /** 테두리 두께와 높이. */
  rimThickness: 0.35,
  rimHeight: 0.55,
  /** 주사위 한 변. */
  die: 0.78,
  /** 홀드 자리 줄의 z. 판 위쪽 테두리 가까이. */
  holdRowZ: -8.4 / 2 + 0.85,
  /** 정렬 줄의 z. 판 가운데. */
  lineupZ: 0.2,
  /** 열 간격. */
  columnGap: 1.05,
  /** 컵: 판 오른쪽 아래(앞쪽) 모서리 근처. */
  cup: { x: 2.15, z: 3.15, radius: 0.87, height: 1.4 },
} as const;

/** 열(0~4)의 x 좌표. */
export function columnX(column: number): number {
  return (column - 2) * BOARD.columnGap;
}

export type Vec3 = readonly [number, number, number];

/** 판 전체(테두리 바깥 모서리, 테두리 높이 포함)의 꼭짓점. */
export function boardCorners(): Vec3[] {
  const x = BOARD.width / 2 + BOARD.rimThickness;
  const z = BOARD.depth / 2 + BOARD.rimThickness;
  const points: Vec3[] = [];
  for (const sx of [-x, x])
    for (const sz of [-z, z])
      for (const y of [0, BOARD.rimHeight]) {
        points.push([sx, y, sz]);
      }
  return points;
}

/** 컵을 감싸는 상자의 꼭짓점. */
export function cupCorners(): Vec3[] {
  const { x, z, radius, height } = BOARD.cup;
  const points: Vec3[] = [];
  for (const dx of [-radius, radius])
    for (const dz of [-radius, radius])
      for (const y of [0, height]) {
        points.push([x + dx, y, z + dz]);
      }
  return points;
}

/** 정렬 줄 다섯 칸의 주사위를 감싸는 상자의 꼭짓점. */
export function lineupCorners(): Vec3[] {
  const half = BOARD.die / 2;
  const points: Vec3[] = [];
  for (const x of [columnX(0) - half, columnX(4) + half]) {
    for (const z of [BOARD.lineupZ - half, BOARD.lineupZ + half]) {
      for (const y of [0, BOARD.die]) points.push([x, y, z]);
    }
  }
  return points;
}
