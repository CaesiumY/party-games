import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // 엔진·저장소·배치 계산은 node 에서 돈다. 화면 테스트만 파일 첫 줄에 jsdom 을 적는다.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
