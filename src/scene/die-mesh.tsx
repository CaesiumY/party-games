import { useMemo } from "react";
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { DieValue } from "../engine/types";
import { BOARD, type Vec3 } from "../layout/board";
import { FACE_VALUES } from "../layout/placement";

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

function faceTexture(value: DieValue): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f6efe1";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = value === 1 ? "#c8102e" : "#1a1a1a";
    for (const [x, y] of PIPS[value]) {
      ctx.beginPath();
      ctx.arc(x * size, y * size, value === 1 ? 16 : 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

let shared: { geometry: RoundedBoxGeometry; materials: MeshStandardMaterial[] } | null = null;

/** 주사위 다섯 개가 함께 쓰는 모양과 재질. 처음 쓸 때 한 번만 만든다. */
function useDieAssets() {
  return useMemo(() => {
    shared ??= {
      geometry: new RoundedBoxGeometry(BOARD.die, BOARD.die, BOARD.die, 3, 0.1),
      materials: FACE_VALUES.map(
        (value) => new MeshStandardMaterial({ map: faceTexture(value), roughness: 0.4 }),
      ),
    };
    return shared;
  }, []);
}

export interface DieMeshProps {
  position: Vec3;
  rotation: Vec3;
}

/** 단순 정육면체 주사위. 면 배치는 FACE_VALUES 를 따른다. */
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
