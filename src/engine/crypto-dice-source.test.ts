import { describe, expect, it } from "vitest";
import { createCryptoDiceSource } from "./crypto-dice-source";

const request = { player: 0, turn: 1, rollNumber: 1 };

describe("운영 주사위 공급원", () => {
  it("요청한 개수만큼 1~6 의 눈을 내고, 여러 번 굴리면 여섯 눈이 다 나온다", () => {
    const source = createCryptoDiceSource();
    const seen = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      const values = source({ ...request, count: 3 });
      expect(values).toHaveLength(3);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
        seen.add(v);
      }
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("6으로 고르게 나누어지지 않는 큰 난수 바이트는 버리고 다시 뽑아 치우침이 없다", () => {
    const bytes = [255, 0, 253, 7, 252, 251];
    const source = createCryptoDiceSource((buffer) => {
      for (let i = 0; i < buffer.length; i += 1) buffer[i] = bytes.shift() ?? 0;
      return buffer;
    });

    // 255·253·252 는 버린다. 0 → 1, 7 → 2, 251 → 6.
    expect(source({ ...request, count: 3 })).toEqual([1, 2, 6]);
  });
});
