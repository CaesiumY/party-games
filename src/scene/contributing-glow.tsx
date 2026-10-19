import { useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BOARD, columnX } from "../layout/board";
import { useContributingDice, useDiceSlots } from "../store/store-context";

/** 기여 주사위 빛의 색. 디자인 체계(#16)의 차례 노랑. */
const GLOW = "#fee267";

/** 바닥에 번지는 빛: 가운데가 밝고 바깥으로 사라지는 원. */
function haloTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.22,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0, "rgba(254, 226, 103, 1)");
    g.addColorStop(0.45, "rgba(254, 226, 103, 0.55)");
    g.addColorStop(1, "rgba(254, 226, 103, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

let shared: {
  shell: RoundedBoxGeometry;
  shellMaterial: MeshBasicMaterial;
  halo: PlaneGeometry;
  haloMaterial: MeshBasicMaterial;
} | null = null;

function useGlowAssets() {
  return useMemo(() => {
    shared ??= {
      // 주사위보다 조금 큰 상자의 뒷면만 그리면 주사위 둘레에 노란 테두리가 남는다.
      shell: new RoundedBoxGeometry(BOARD.die * 1.26, BOARD.die * 1.26, BOARD.die * 1.26, 3, 0.16),
      shellMaterial: new MeshBasicMaterial({ color: GLOW, side: BackSide, toneMapped: false }),
      halo: new PlaneGeometry(BOARD.die * 2.8, BOARD.die * 2.8),
      haloMaterial: new MeshBasicMaterial({
        map: haloTexture(),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    };
    return shared;
  }, []);
}

/**
 * 기여 주사위 빛(스펙 「3D 장면」: 카테고리를 선택하면 기여 주사위만 빛난다).
 * 선택은 정렬이 끝난 뒤에만 있으므로 주사위는 언제나 정렬 줄이나 홀드 자리의 정해진 열 위치에 있다.
 * 그래서 연출 구현과 따로, 그 자리에 빛을 겹쳐 그린다(탭 판정 영역과 같은 방식).
 */
export function ContributingGlow() {
  const contributing = useContributingDice();
  const slots = useDiceSlots();
  const { shell, shellMaterial, halo, haloMaterial } = useGlowAssets();
  return (
    <group>
      {slots
        .filter((slot) => contributing.includes(slot.id))
        .map((slot) => {
          const x = columnX(slot.column);
          const z = slot.row === "hold" ? BOARD.holdRowZ : BOARD.lineupZ;
          return (
            <group key={slot.id} position={[x, 0, z]}>
              <mesh geometry={shell} material={shellMaterial} position={[0, BOARD.die / 2, 0]} />
              <mesh
                geometry={halo}
                material={haloMaterial}
                position={[0, 0.02, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              />
            </group>
          );
        })}
    </group>
  );
}
