import { useMemo } from "react";
import type { CameraFit } from "../layout/camera-fit";
import { layoutHoldBubbles } from "../layout/hold-bubbles";
import { useDiceSlots, useGame, usePermissions } from "../store/store-context";

/**
 * 홀드 말풍선(스펙 「3D 장면」). 홀드할 수 있는 주사위마다 "킵"(홀드 자리는 "되돌리기")을 띄운다.
 * 카메라와 같은 맞춤 값으로 주사위 자리를 투영해 판 영역 위에 DOM 버튼으로 겹친다.
 * 말풍선과 주사위 어느 쪽을 탭해도 같은 저장소 명령이다. 화면 낭독기는 보이지 않는 주사위 버튼을 쓰므로
 * 말풍선은 접근성 트리에서 뺀다(같은 주사위를 두 번 읽지 않게).
 */
export function HoldBubbles({ fit, topLimit }: { fit: CameraFit; topLimit: number }) {
  const slots = useDiceSlots();
  const can = usePermissions();
  const toggleHold = useGame((s) => s.toggleHold);
  const bubbles = useMemo(
    () =>
      layoutHoldBubbles(
        fit,
        slots.filter((slot) => can.canHold(slot.id)),
        topLimit,
      ),
    [fit, slots, can, topLimit],
  );
  if (bubbles.length === 0) return null;
  return (
    <div className="hold-bubbles" aria-hidden="true">
      {bubbles.map((b) => (
        <button
          key={b.id}
          type="button"
          tabIndex={-1}
          data-die={b.id}
          className={`hold-bubble ${b.side}${b.row === "hold" ? " release" : ""}`}
          style={{ left: b.x, top: b.y, width: b.width, fontSize: b.fontSize }}
          onClick={() => toggleHold(b.id)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
