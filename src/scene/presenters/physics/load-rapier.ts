import type RAPIER from "@dimforge/rapier3d-compat";

/** Rapier 물리 엔진 모듈(WASM 초기화가 끝난 것). */
export type Rapier = typeof RAPIER;

let loading: Promise<Rapier> | undefined;

/**
 * Rapier 를 처음 쓸 때 한 번만 불러와 초기화한다. WASM 이 든 큰 파일이라 첫 화면 번들에서 떼어 둔다.
 * 브라우저와 Node(테스트) 모두에서 같은 방법으로 된다.
 */
export function loadRapier(): Promise<Rapier> {
  loading ??= import("@dimforge/rapier3d-compat").then(async ({ default: rapier }) => {
    await rapier.init();
    return rapier;
  });
  return loading;
}
