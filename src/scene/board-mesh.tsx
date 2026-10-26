import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BOARD, columnX } from "../layout/board";
import { COLUMNS } from "../layout/columns";
import { canvasTexture, speckle } from "./textures";

/** 빨간 펠트. 비스듬히 보이므로 이방성 필터를 조금 걸어 멀리서도 결이 뭉개지지 않게 한다. */
function feltMaterial(): MeshStandardMaterial {
  const map = canvasTexture(512, (ctx, size) => speckle(ctx, size, "#8e0f1f", 0.22, 26000));
  map.anisotropy = 4;
  return new MeshStandardMaterial({ map, roughness: 1 });
}

/** 홀드 자리 칸: 진한 와인색 바탕에 금색 테두리와 "킵" 글자(홀드 말풍선과 같은 말). */
function holdSlotMaterial(): MeshStandardMaterial {
  const map = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = "#5e0914";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, size - 28, size - 28);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#c9a24a";
    ctx.font = "700 56px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("킵", size / 2, size / 2);
  });
  return new MeshStandardMaterial({ map, roughness: 0.9 });
}

/** 테두리 네 개(위·아래·왼쪽·오른쪽). 판 바깥에 붙고 모서리를 조금 둥글린다. */
function rimPieces() {
  const { width, depth, rimThickness: t, rimHeight } = BOARD;
  const pieces: [number, number, number, number][] = [
    [0, -depth / 2 - t / 2, width + t * 2, t],
    [0, depth / 2 + t / 2, width + t * 2, t],
    [-width / 2 - t / 2, 0, t, depth],
    [width / 2 + t / 2, 0, t, depth],
  ];
  return pieces.map(([x, z, w, d]) => ({
    key: `${x},${z}`,
    position: [x, rimHeight / 2, z] as const,
    geometry: new RoundedBoxGeometry(w, rimHeight, d, 2, 0.06),
  }));
}

let shared: {
  felt: MeshStandardMaterial;
  rim: MeshStandardMaterial;
  slot: MeshStandardMaterial;
  rims: ReturnType<typeof rimPieces>;
} | null = null;

/** 판이 쓰는 재질과 테두리 모양. 처음 쓸 때 한 번만 만든다. */
function useBoardAssets() {
  return useMemo(() => {
    shared ??= {
      felt: feltMaterial(),
      rim: new MeshStandardMaterial({ color: "#141012", roughness: 0.45, metalness: 0.1 }),
      slot: holdSlotMaterial(),
      rims: rimPieces(),
    };
    return shared;
  }, []);
}

/**
 * 판(카지노 펠트 룩): 빨간 펠트 바닥, 모서리를 둥글린 검은 테두리, 위쪽의 홀드 자리 다섯 칸.
 * 오른쪽 아래의 컵은 굴림 연출이 흔들고 쏟으므로 연출 구현이 그린다(cup-mesh.tsx).
 */
export function BoardMesh() {
  const { felt, rim, slot, rims } = useBoardAssets();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={felt} receiveShadow>
        <planeGeometry args={[BOARD.width, BOARD.depth]} />
      </mesh>
      {rims.map(({ key, position, geometry }) => (
        <mesh
          key={key}
          geometry={geometry}
          material={rim}
          position={position}
          castShadow
          receiveShadow
        />
      ))}
      {COLUMNS.map((column) => (
        <mesh
          key={column}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[columnX(column), 0.005, BOARD.holdRowZ]}
          material={slot}
          receiveShadow
        >
          <planeGeometry args={[0.98, 0.98]} />
        </mesh>
      ))}
    </group>
  );
}
