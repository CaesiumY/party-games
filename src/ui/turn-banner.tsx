import { useEffect } from "react";
import { useGame } from "../store/store-context";
import { PlayerDot } from "./player-dot";

/**
 * 차례 배너가 떠 있는 시간(ms). 원작의 차례 넘김 연출(노란 세로줄이 옮겨 가고 컵이 들어오기까지)이
 * 약 2초라서 같게 둔다(docs/research/yacht-51-original.md 4.7). 조작을 막지 않으므로 길어도 흐름이 끊기지 않는다.
 */
export const TURN_BANNER_MS = 2000;

/**
 * 차례 배너(스펙 「차례 배너」). 대전 모드에서 화면의 차례가 넘어갈 때 판 가운데에 「다음은 ○○ 차례」를
 * 잠깐 띄운다. 조작을 막지 않고 확인 버튼도 없다(누르기는 아래로 지나간다).
 * 판 위에 겹치지만 잠깐 뜨는 것이라 카메라 맞춤이 피할 자리가 아니어서 data-board-overlay 를 붙이지 않는다.
 */
export function TurnBannerView() {
  const banner = useGame((s) => s.turnBanner);
  if (!banner) return null;
  return <BannerText key={banner.id} id={banner.id} player={banner.player} />;
}

function BannerText({ id, player }: { id: number; player: number }) {
  const name = useGame((s) => s.game.players[player]?.name ?? "");
  const ended = useGame((s) => s.turnBannerEnded);
  useEffect(() => {
    const timer = setTimeout(() => ended(id), TURN_BANNER_MS);
    return () => clearTimeout(timer);
  }, [id, ended]);
  return (
    <div className="turn-banner" role="status">
      <PlayerDot player={player} />
      <span>다음은 {name} 차례</span>
    </div>
  );
}
