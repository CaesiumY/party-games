import { useMemo } from "react";
import { type CanvasTexture, MeshPhysicalMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { DieValue } from "../engine/types";
import { BOARD, type Vec3 } from "../layout/board";
import { FACE_VALUES } from "../layout/placement";
import { canvasTexture } from "./textures";

const PIPS: Record<DieValue, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.27, 0.27],
    [0.5, 0.5],
    [0.73, 0.73],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.27, 0.25],
    [0.73, 0.25],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.75],
    [0.73, 0.75],
  ],
};

/** 면 텍스처: 상아색 바탕에 검은 눈, 1의 눈만 크고 빨갛다. */
function faceTexture(value: DieValue): CanvasTexture {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = "#f6efe1";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = value === 1 ? "#c8102e" : "#111111";
    for (const [x, y] of PIPS[value]) {
      ctx.beginPath();
      ctx.arc(x * size, y * size, value === 1 ? 30 : 22, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

let shared: { geometry: RoundedBoxGeometry; materials: MeshPhysicalMaterial[] } | null = null;

/** 주사위 다섯 개가 함께 쓰는 모양과 재질. 처음 쓸 때 한 번만 만든다. */
function useDieAssets() {
  return useMemo(() => {
    shared ??= {
      geometry: new RoundedBoxGeometry(BOARD.die, BOARD.die, BOARD.die, 4, 0.1),
      // 윤이 나는 플라스틱: 겉칠(clearcoat) 한 겹. 주사위는 화면에서 차지하는 넓이가 작아 이 재질을
      // 써도 부담이 적다. 판·컵은 기본 재질(MeshStandardMaterial)로 둔다.
      materials: FACE_VALUES.map(
        (value) =>
          new MeshPhysicalMaterial({
            map: faceTexture(value),
            roughness: 0.28,
            clearcoat: 0.6,
            clearcoatRoughness: 0.25,
          }),
      ),
    };
    return shared;
  }, []);
}

export interface DieMeshProps {
  position: Vec3;
  rotation: Vec3;
}

/**
 * 상아색 플라스틱 주사위(카지노 펠트 룩). 면 배치는 FACE_VALUES 를 따른다.
 * 모서리 반지름(0.1)은 물리 충돌체와 같아야 한다(presenters/physics/pre-roll.ts 의 DIE_CORNER).
 */
export function DieMesh({ position, rotation }: DieMeshProps) {
  const { geometry, materials } = useDieAssets();
  return (
    <mesh
      geometry={geometry}
      material={materials}
      position={position as [number, number, number]}
      rotation={rotation as [number, number, number]}
      castShadow
    />
  );
}
