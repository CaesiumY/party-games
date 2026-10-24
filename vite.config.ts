import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    // 테스트용 빌드(`vite build --mode e2e`)에서만 참이다. 운영 빌드에서는 거짓으로 박혀
    // E2E 용 주사위 공급원(src/engine/e2e-dice-source.ts)이 번들에서 빠진다(scripts/check-build.ts 가 검사).
    __E2E_DICE_SOURCE__: JSON.stringify(mode === "e2e"),
  },
  test: {
    // 엔진·저장소·배치 계산은 node 에서 돈다. 화면 테스트만 파일 첫 줄에 jsdom 을 적는다.
    environment: "node",
    // E2E(e2e/, Playwright)는 여기서 돌리지 않는다. `pnpm e2e` 로 따로 돈다.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
}));
