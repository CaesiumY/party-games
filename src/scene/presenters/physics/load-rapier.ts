import type RAPIER from "@dimforge/rapier3d-compat";

/** Rapier 물리 엔진 모듈(WASM 초기화가 끝난 것). */
export type Rapier = typeof RAPIER;

/**
 * 성공한 결과만 기억하는 불러오기. 진행 중이거나 성공한 약속은 함께 쓰고,
 * 실패하면 잊어서 다음 호출이 다시 시도한다(그 굴림은 순간 배치로 넘어간다).
 */
export function onceUntilFailure<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      const attempt = load();
      pending = attempt;
      attempt.catch(() => {
        if (pending === attempt) pending = undefined;
      });
    }
    return pending;
  };
}

/**
 * Rapier 를 처음 쓸 때 불러와 초기화한다. WASM 이 든 큰 파일이라 첫 화면 번들에서 떼어 둔다.
 * 브라우저와 Node(테스트) 모두에서 같은 방법으로 된다.
 */
export const loadRapier = onceUntilFailure<Rapier>(async () => {
  const { default: rapier } = await import("@dimforge/rapier3d-compat");
  await rapier.init();
  return rapier;
});
