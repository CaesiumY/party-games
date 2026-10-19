import { useEffect } from "react";
import { restPose } from "../../layout/placement";
import { DieMesh } from "../die-mesh";
import type { RollPresenterProps } from "../roll-presenter";

/**
 * 순간 배치 연출. 굴러가는 모습 없이 주사위를 정렬이 끝난 자리에 바로 놓고,
 * 멈춤과 정렬 끝을 곧바로 알린다. '동작 줄이기' 경로이며 첫 구현이다.
 */
export function InstantPresenter({ rollId, dice, onStopped, onLinedUp }: RollPresenterProps) {
  useEffect(() => {
    if (rollId === 0) return;
    onStopped(rollId);
    onLinedUp(rollId);
  }, [rollId, onStopped, onLinedUp]);

  return (
    <group>
      {dice.map((die) => {
        const pose = restPose(die);
        return <DieMesh key={die.id} position={pose.position} rotation={pose.rotation} />;
      })}
    </group>
  );
}
