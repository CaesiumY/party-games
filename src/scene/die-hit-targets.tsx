import type { ThreeEvent } from "@react-three/fiber";
import { BOARD, columnX } from "../layout/board";
import { useDiceSlots, useGame, usePermissions } from "../store/store-context";

/**
 * 주사위 탭 판정 영역(스펙 「3D 장면」). 화면 좌표로 3D 물체를 찾는 방식(레이캐스트)이며,
 * 주사위보다 넉넉하다. 가로는 이웃 열과 겹치지 않을 만큼, 세로·깊이는 더 넉넉하게 잡는다.
 * 탭 대상은 언제나 정렬 줄이나 홀드 자리의 정해진 열 위치에 있으므로 연출 구현과 따로 둔다.
 * 마우스 클릭도 같은 방식으로 동작한다. 그리지 않는 상자다(visible=false 여도 레이캐스트는 맞는다).
 */
const HIT_BOX: [number, number, number] = [
  BOARD.columnGap * 0.98,
  BOARD.die * 1.6,
  BOARD.die * 1.6,
];

export function DieHitTargets() {
  const slots = useDiceSlots();
  const can = usePermissions();
  const toggleHold = useGame((s) => s.toggleHold);
  return (
    <group>
      {slots
        .filter((slot) => can.canHold(slot.id))
        .map((slot) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: three.js 물체다(HTML 요소가 아님). 화면 낭독기는 보이지 않는 주사위 버튼을 쓴다.
          <mesh
            key={slot.id}
            visible={false}
            position={[
              columnX(slot.column),
              BOARD.die / 2,
              slot.row === "hold" ? BOARD.holdRowZ : BOARD.lineupZ,
            ]}
            onClick={(event: ThreeEvent<MouseEvent>) => {
              // 겹친 다른 물체에 같은 탭이 또 가지 않게 한다.
              event.stopPropagation();
              toggleHold(slot.id);
            }}
          >
            <boxGeometry args={HIT_BOX} />
          </mesh>
        ))}
    </group>
  );
}
