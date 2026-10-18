/** `matchMedia("(prefers-reduced-motion: reduce)")` 가 돌려주는 것 중 여기서 쓰는 부분. */
export interface MotionQuery {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * 기기의 '동작 줄이기' 설정을 지금 값으로 한 번 알리고, 바뀔 때마다 다시 알린다.
 * 돌려주는 함수를 부르면 더 알리지 않는다.
 */
export function syncReducedMotion(query: MotionQuery, apply: (on: boolean) => void): () => void {
  const onChange = () => apply(query.matches);
  onChange();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** 브라우저에서 쓰는 설정 질의. matchMedia 가 없으면(오래된 환경) null. */
export function browserMotionQuery(): MotionQuery | null {
  return typeof matchMedia === "function" ? matchMedia(REDUCED_MOTION_QUERY) : null;
}
