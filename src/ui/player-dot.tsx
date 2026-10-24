/** 플레이어 수의 최대값(점수표 세로줄 수). 색 토큰 `--player-1`~`--player-4` 와 같은 수다. */
const PLAYER_COLOR_COUNT = 4;

/**
 * 플레이어 색(스펙 「플레이어 색과 차례 강조」). 순번(자리)으로 정해져서, 같은 멤버로 다시 하면 색도 그대로다.
 * 값은 src/ui/tokens.css 의 `--player-n` 한 곳에 있다(파랑·초록·보라·빨강, 노랑·주황 계열 없음).
 */
export function playerColor(player: number): string {
  return `var(--player-${(player % PLAYER_COLOR_COUNT) + 1})`;
}

/**
 * 플레이어 색 점. 색만으로 누구인지 알리지 않으므로 언제나 이름 옆에 쓰고, 화면 낭독기에서는 빠진다.
 * 테두리는 바탕에 따라 CSS 가 고른다(어두운 바탕 흰색, 밝은 바탕·노란 강조 위 진한 색).
 */
export function PlayerDot({ player, size }: { player: number; size?: "small" | "large" }) {
  return (
    <span
      className={size ? `player-dot ${size}` : "player-dot"}
      style={{ background: playerColor(player) }}
      aria-hidden="true"
    />
  );
}
