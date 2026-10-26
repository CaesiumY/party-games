import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOUND_CLIPS } from "./clips";

const PUBLIC = new URL("../../public/", import.meta.url);
const SOUNDS = new URL("sounds/", PUBLIC);
const listed = [...SOUND_CLIPS.shake, ...SOUND_CLIPS.hit];
/** 앱의 주소(`/sounds/…`)를 public 폴더 안의 파일 이름으로. */
const fileOf = (url: string) => url.replace(/^.*\/sounds\//, "");

describe("음원 목록", () => {
  it("컵 흔드는 소리 하나와, 번갈아 쓸 충돌음 여러 개가 있다", () => {
    expect(SOUND_CLIPS.shake.length).toBeGreaterThanOrEqual(1);
    expect(SOUND_CLIPS.hit.length).toBeGreaterThanOrEqual(3);
  });

  it("목록의 파일은 모두 public/sounds 에 있고, 그 폴더의 음원은 모두 목록에 있다", () => {
    for (const url of listed) {
      expect(url.startsWith(`${import.meta.env.BASE_URL}sounds/`), url).toBe(true);
      expect(existsSync(new URL(fileOf(url), SOUNDS)), url).toBe(true);
    }
    const files = readdirSync(SOUNDS).filter((name) => name !== "CREDITS.md");
    expect(files.sort()).toEqual(listed.map(fileOf).sort());
  });

  it("출처 기록(CREDITS.md)이 파일마다 CC0 원본을 적는다", () => {
    const credits = readFileSync(new URL("CREDITS.md", SOUNDS), "utf8");
    expect(credits).toContain("CC0 1.0");
    for (const url of listed) expect(credits).toContain(fileOf(url));
  });

  it("음원은 모두 합쳐 400 KB 아래다", () => {
    const total = listed.reduce(
      (sum, url) => sum + readFileSync(new URL(fileOf(url), SOUNDS)).byteLength,
      0,
    );
    expect(total).toBeLessThan(400 * 1024);
  });
});
