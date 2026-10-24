import { rollsLeft } from "../engine/game";
import { useGame, useShownPlayer } from "../store/store-context";
import { PlayerDot } from "./player-dot";

/** 남은 굴림 표시. 판 영역 오른쪽 위에 겹친다. */
export function RollsLeft({ overlayAttr }: { overlayAttr: Record<string, string> }) {
  const left = useGame((s) => rollsLeft(s.game));
  return (
    <div className="rolls-left" {...overlayAttr}>
      앞으로 {left}번
    </div>
  );
}

/**
 * 지금 차례 표시: 플레이어 색 점과 이름. 세로 배치는 판 영역 왼쪽 위, 가로 배치는 아래 가운데.
 * 연습 모드에도 띄운다. 보너스 알림 동안은 방금 기록한 플레이어를 보여 준다.
 */
export function CurrentPlayer({ overlayAttr }: { overlayAttr: Record<string, string> }) {
  const shown = useShownPlayer();
  const name = useGame((s) => s.game.players[shown]?.name ?? "");
  return (
    <div className="current-player" {...overlayAttr}>
      <PlayerDot player={shown} size="large" />
      <span>{name}</span>
    </div>
  );
}
