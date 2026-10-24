import { defineConfig } from "@playwright/test";

/** 이 기기의 다른 개발 서버와 겹치지 않을 포트. 남이 띄운 서버를 잘못 재사용하지 않도록 언제나 새로 띄운다. */
const PORT = 47915;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E 테스트(스펙 Testing Decisions 「테스트 지점 ②」). 로컬에서만 `pnpm e2e` 로 돌린다(CI 에는 넣지 않음, #15 결정).
 * 테스트용 빌드(`--mode e2e`, E2E 용 주사위 공급원)를 만들어 미리보기 서버로 띄운다.
 */
export default defineConfig({
  testDir: "e2e",
  // 한 판을 끝까지 하는 테스트 하나다. 차례 배너(2초)·보너스 알림을 기다리느라 길다.
  timeout: 5 * 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    // '동작 줄이기'를 켜서 굴림 연출을 건너뛴다.
    reducedMotion: "reduce",
    viewport: { width: 375, height: 667 },
    locale: "ko-KR",
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    browserName: "chromium",
    launchOptions: {
      // 화면 없이 도는 크로미움은 GPU 가 없어 WebGL 을 끈다. 소프트웨어 렌더러(SwiftShader)로 켠다.
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command: `pnpm exec vite build --mode e2e --outDir dist-e2e --emptyOutDir && pnpm exec vite preview --outDir dist-e2e --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
