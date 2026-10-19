import { useMemo } from "react";
import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import { BOARD, columnX } from "../layout/board";

function holdSlotTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#5e0914";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, size - 16, size - 16);
    ctx.fillStyle = "rgba(201, 162, 74, 0.75)";
    ctx.font = "700 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("킵", size / 2, size / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** 판: 펠트 바닥, 검은 테두리, 위쪽의 홀드 자리 다섯 칸, 오른쪽 아래의 컵. 기본 도형만 쓴다. */
export function BoardMesh() {
  const slotTexture = useMemo(holdSlotTexture, []);
  const { width, depth, rimThickness: t, rimHeight, cup } = BOARD;
  const rims: [number, number, number, number][] = [
    [0, -depth / 2 - t / 2, width + t * 2, t],
    [0, depth / 2 + t / 2, width + t * 2, t],
    [-width / 2 - t / 2, 0, t, depth],
    [width / 2 + t / 2, 0, t, depth],
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#8e0f1f" roughness={1} />
      </mesh>
      {rims.map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x, rimHeight / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[w, rimHeight, d]} />
          <meshStandardMaterial color="#141012" roughness={0.5} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((column) => (
        <mesh
          key={column}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[columnX(column), 0.005, BOARD.holdRowZ]}
          receiveShadow
        >
          <planeGeometry args={[0.98, 0.98]} />
          <meshStandardMaterial map={slotTexture} roughness={0.9} />
        </mesh>
      ))}
      <group position={[cup.x, 0, cup.z]}>
        <mesh position={[0, cup.height / 2, 0]} castShadow>
          <cylinderGeometry args={[cup.radius, cup.radius * 0.72, cup.height, 32, 1, true]} />
          <meshStandardMaterial color="#4a2a18" roughness={0.7} side={DoubleSide} />
        </mesh>
        <mesh position={[0, cup.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[cup.radius, 0.06, 10, 40]} />
          <meshStandardMaterial color="#b08850" roughness={0.35} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
