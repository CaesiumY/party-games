import { screenOrder } from "../layout/columns";
import { useAllDiceUp, useDiceSlots, useGame, usePermissions } from "../store/store-context";

/**
 * 보이지 않는 주사위 버튼 다섯 개(스펙 「보이지 않는 주사위 버튼」). 화면 낭독기가 읽는다.
 * 순서는 화면과 같다(홀드 자리의 주사위들, 그다음 정렬 줄의 주사위들, 각각 왼쪽 열부터).
 * 각 버튼은 눈과 홀드 여부를 읽어 주고, 누르면 3D 탭과 같은 저장소 명령으로 홀드를 토글한다.
 * 3번째 굴림 뒤에는 홀드 토글 없이 눈만 읽어 준다. 홀드할 수 없을 때도 초점은 받도록 aria-disabled 를 쓴다.
 */
export function DiceButtons() {
  const dice = useGame((s) => s.game.dice);
  const toggleHold = useGame((s) => s.toggleHold);
  const slots = useDiceSlots();
  const allUp = useAllDiceUp();
  const can = usePermissions();
  return (
    <fieldset aria-label="주사위" className="visually-hidden">
      {screenOrder(slots).map((id) => {
        const die = dice[id];
        const slot = slots[id];
        if (!die || !slot) return null;
        const enabled = can.canHold(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={allUp ? undefined : slot.row === "hold"}
            aria-disabled={enabled ? undefined : true}
            onClick={() => {
              if (enabled) toggleHold(id);
            }}
          >
            주사위 {die.value}
          </button>
        );
      })}
    </fieldset>
  );
}
