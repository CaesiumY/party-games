import { useGame, usePermissions } from "../store/store-context";

/** 굴림·기록 버튼. 세로 배치에서는 판 영역 왼쪽 아래에 겹치고, 가로 배치에서는 판 바로 아래에 놓인다. */
export function Actions({ overlayAttr }: { overlayAttr?: Record<string, string> }) {
  const rolled = useGame((s) => s.game.rollsUsed > 0);
  const roll = useGame((s) => s.roll);
  const record = useGame((s) => s.record);
  const can = usePermissions();
  return (
    <div className="actions" {...overlayAttr}>
      <button type="button" className="roll" disabled={!can.canRoll} onClick={() => roll()}>
        {rolled ? "다시 던지기" : "주사위 던지기"}
      </button>
      <button type="button" className="record" disabled={!can.canRecord} onClick={() => record()}>
        기록
      </button>
    </div>
  );
}
