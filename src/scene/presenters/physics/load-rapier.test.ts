import { describe, expect, it } from "vitest";
import { onceUntilFailure } from "./load-rapier";

describe("물리 엔진 불러오기", () => {
  it("한 번 불러오면 다시 불러오지 않는다", async () => {
    let calls = 0;
    const load = onceUntilFailure(async () => ++calls);
    expect(await load()).toBe(1);
    expect(await load()).toBe(1);
    expect(calls).toBe(1);
  });

  it("불러오기에 실패하면 다음 굴림에서 다시 시도한다", async () => {
    let calls = 0;
    const load = onceUntilFailure(async () => {
      calls++;
      if (calls === 1) throw new Error("네트워크 끊김");
      return "엔진";
    });
    await expect(load()).rejects.toThrow("네트워크 끊김");
    expect(await load()).toBe("엔진");
    expect(calls).toBe(2);
  });
});
