import { scorePreview } from "../engine/game";
import { useSound } from "../sound/sound-context";
import { useAllDiceUp, useGame, usePermissions } from "../store/store-context";

/**
 * 굴림·기록 버튼. 세로 배치에서는 판 영역 왼쪽 아래에 겹치고, 가로 배치에서는 판 바로 아래에 놓인다.
 * 3번째 굴림이 끝나면 굴림 버튼은 사라진다. 자리는 그대로 두어 판(카메라 맞춤)이 움직이지 않게 한다.
 * 모바일 브라우저의 자동 재생 제한은 굴림 버튼 탭에서 푼다(스펙 「소리」). 굴림보다 먼저 풀어야 그 굴림의 소리가 난다.
 */
export function Actions({ overlayAttr }: { overlayAttr?: Record<string, string> }) {
  const rolled = useGame((s) => s.game.rollsUsed > 0);
  const roll = useGame((s) => s.roll);
  const record = useGame((s) => s.record);
  // 고른 카테고리가 성립하지 않으면(점수 미리보기 0) 스크래치임을 알린다.
  const scratch = useGame((s) => s.selection !== null && scorePreview(s.game, s.selection) === 0);
  const sound = useSound();
  const can = usePermissions();
  const allUp = useAllDiceUp();
  return (
    <div className="actions" {...overlayAttr}>
      <button
        type="button"
        // 첫 굴림은 주 버튼(노랑), 다시 던지기는 보조 버튼(크림색). 이때는 기록이 주 버튼이다.
        className={rolled ? "roll secondary" : "roll primary"}
        disabled={!can.canRoll}
        style={allUp ? { visibility: "hidden" } : undefined}
        onClick={() => {
          sound.unlock();
          roll();
        }}
      >
        {rolled ? "다시 던지기" : "주사위 던지기"}
      </button>
      <button
        type="button"
        className="record primary"
        disabled={!can.canRecord}
        onClick={() => record()}
      >
        {scratch ? "0점으로 기록" : "기록"}
      </button>
    </div>
  );
}
