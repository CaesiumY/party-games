import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 게임 엔진은 React·three.js·브라우저 API 에 기대지 않는 순수 모듈이다(스펙 「모듈 구조」).
const dir = join(import.meta.dirname, ".");
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("게임 엔진의 경계", () => {
  it.each(sources)("%s 는 엔진 안의 파일만 가져온다", (file) => {
    const code = readFileSync(join(dir, file), "utf8");
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.filter((path) => !path?.startsWith("./"))).toEqual([]);
  });

  it.each(sources)("%s 는 화면·브라우저 저장소 API 를 쓰지 않는다", (file) => {
    const code = readFileSync(join(dir, file), "utf8");
    expect(code).not.toMatch(/\b(window|document|localStorage|navigator|matchMedia)\b/);
  });
});
