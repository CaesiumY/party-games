import { DoubleSide } from "three";
import { BOARD } from "../layout/board";

/**
 * 컵 모양: 금속빛 테두리를 두른 가죽 컵. 원점은 바닥 원의 가운데라, 이 원점을 짚고 기울이면 된다.
 * 놓을 자리와 자세는 그리는 쪽(굴림 연출 구현)이 정한다. 바닥은 막아 두어 누웠을 때 속이 비쳐 보이지 않게 한다.
 */
export function CupShape() {
  const { radius, bottomRadius, height } = BOARD.cup;
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[radius, bottomRadius, height, 32, 1, true]} />
        <meshStandardMaterial color="#4a2a18" roughness={0.7} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[bottomRadius, 32]} />
        <meshStandardMaterial color="#2a160c" roughness={0.8} side={DoubleSide} />
      </mesh>
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.06, 10, 40]} />
        <meshStandardMaterial color="#b08850" roughness={0.35} metalness={0.4} />
      </mesh>
    </group>
  );
}
