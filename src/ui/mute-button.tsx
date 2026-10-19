import { useGame } from "../store/store-context";

/**
 * 음소거 버튼(스펙 「소리」). 판 영역 오른쪽 위, 남은 굴림 표시 왼쪽에 겹친다.
 * 누를 때마다 끄고 켜며, 설정은 저장소가 이 기기에 저장한다.
 */
export function MuteButton() {
  const muted = useGame((s) => s.muted);
  const toggle = useGame((s) => s.toggleMuted);
  return (
    <button
      type="button"
      className="mute"
      aria-label="음소거"
      aria-pressed={muted}
      title={muted ? "소리 켜기" : "소리 끄기"}
      onClick={() => toggle()}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path
            d="M16 9l5 6M21 9l-5 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
