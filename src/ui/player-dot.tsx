/**
 * 플레이어 색(스펙 「플레이어 색과 차례 강조」). 순번(자리)으로 정해져서, 같은 멤버로 다시 하면 색도 그대로다.
 * 노란 차례 강조와 섞이지 않게 노랑·주황 계열은 쓰지 않는다. 디자인 초안의 파랑·초록·보라·빨강.
 */
export const PLAYER_COLORS = ["#2f6bff", "#1fa45b", "#8b4dff", "#e5383b"] as const;

export function playerColor(player: number): string {
  return PLAYER_COLORS[player % PLAYER_COLORS.length] ?? PLAYER_COLORS[0];
}

/**
 * 플레이어 색 점. 색만으로 누구인지 알리지 않으므로 언제나 이름 옆에 쓰고, 화면 낭독기에서는 빠진다.
 * 테두리는 바탕에 따라 CSS 가 고른다(어두운 바탕 흰색, 노란 강조 위 진한 색).
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
