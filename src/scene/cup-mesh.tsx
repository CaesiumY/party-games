import { useMemo } from "react";
import { BackSide, DoubleSide, FrontSide, MeshStandardMaterial } from "three";
import { BOARD } from "../layout/board";
import { canvasTexture, speckle } from "./textures";

let shared: {
  leather: MeshStandardMaterial;
  lining: MeshStandardMaterial;
  sole: MeshStandardMaterial;
  rim: MeshStandardMaterial;
} | null = null;

/** 컵이 쓰는 재질. 처음 쓸 때 한 번만 만든다. */
function useCupMaterials() {
  return useMemo(() => {
    shared ??= {
      // 가죽: 갈색 바탕에 결. 안쪽도 보이므로 양면.
      leather: new MeshStandardMaterial({
        map: canvasTexture(256, (ctx, size) => speckle(ctx, size, "#4a2a18", 0.3, 9000)),
        roughness: 0.7,
        side: DoubleSide,
      }),
      // 안쪽 바닥은 벽과 같은 가죽 결을 조금 더 어둡게(빨간 펠트면 바닥이 뚫려 판이 비쳐 보였다), 바깥 바닥은 짙은 가죽.
      lining: new MeshStandardMaterial({
        map: canvasTexture(256, (ctx, size) => speckle(ctx, size, "#3a2014", 0.3, 9000)),
        roughness: 0.75,
        side: FrontSide,
      }),
      sole: new MeshStandardMaterial({ color: "#2a160c", roughness: 0.8, side: BackSide }),
      rim: new MeshStandardMaterial({ color: "#b08850", roughness: 0.35, metalness: 0.4 }),
    };
    return shared;
  }, []);
}

/**
 * 컵 모양(카지노 펠트 룩): 금속빛 테두리를 두른 가죽 컵, 안쪽 바닥은 어두운 가죽 안감.
 * 원점은 바닥 원의 가운데라, 이 원점을 짚고 기울이면 된다.
 * 놓을 자리와 자세는 그리는 쪽(굴림 연출 구현)이 정한다. 바닥은 막아 두어 누웠을 때 속이 비쳐 보이지 않게 한다.
 */
export function CupShape() {
  const { radius, bottomRadius, height } = BOARD.cup;
  const { leather, lining, sole, rim } = useCupMaterials();
  return (
    <group>
      <mesh position={[0, height / 2, 0]} material={leather} castShadow>
        <cylinderGeometry args={[radius, bottomRadius, height, 32, 1, true]} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={lining}>
        <circleGeometry args={[bottomRadius, 32]} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} material={sole}>
        <circleGeometry args={[bottomRadius, 32]} />
      </mesh>
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} material={rim}>
        <torusGeometry args={[radius, 0.06, 10, 40]} />
      </mesh>
    </group>
  );
}
