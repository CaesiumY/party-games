import { useEffect } from "react";
import { BOARD } from "../../layout/board";
import { restPose } from "../../layout/placement";
import { CupShape } from "../cup-mesh";
import { DieMesh } from "../die-mesh";
import type { RollPresenterProps } from "../roll-presenter";

/**
 * 순간 배치 연출. 굴러가는 모습 없이 주사위를 정렬이 끝난 자리에 바로 놓고,
 * 멈춤과 정렬 끝을 곧바로 알린다. 홀드 등으로 자리가 바뀌어도 바로 옮기고 다 옮겼다고 알린다.
 * '동작 줄이기' 경로이며 첫 구현이다. 컵은 제자리에 서 있다.
 */
export function InstantPresenter({
  rollId,
  dice,
  onStopped,
  onLinedUp,
  onDieSettled,
}: RollPresenterProps) {
  useEffect(() => {
    if (rollId === 0) return;
    onStopped(rollId);
    onLinedUp(rollId);
  }, [rollId, onStopped, onLinedUp]);

  useEffect(() => {
    for (const die of dice) onDieSettled(die.id);
  }, [dice, onDieSettled]);

  return (
    <group>
      <group position={[BOARD.cup.x, 0, BOARD.cup.z]}>
        <CupShape />
      </group>
      {dice.map((die) => {
        const pose = restPose(die);
        return <DieMesh key={die.id} position={pose.position} rotation={pose.rotation} />;
      })}
    </group>
  );
}
