import { useSyncExternalStore } from "react";
import { browserMotionQuery } from "./reduced-motion";

function subscribe(onChange: () => void): () => void {
  const query = browserMotionQuery();
  if (!query) return () => {};
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const snapshot = () => browserMotionQuery()?.matches ?? false;

/**
 * 기기의 '동작 줄이기' 설정. 게임 상태 저장소 밖(결과 화면 등)에서도 쓸 수 있도록 설정 질의를 직접 읽는다.
 * matchMedia 가 없는 환경(테스트)에서는 꺼진 것으로 본다.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
