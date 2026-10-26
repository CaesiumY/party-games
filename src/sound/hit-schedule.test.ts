import { describe, expect, it } from "vitest";
import { hitSchedule, MAX_VOICES } from "./hit-schedule";

describe("충돌음 일정", () => {
  it("떨어져 있는 부딪힘은 모두 시각 순서로 울리고, 세게 부딪힐수록 크게 울린다", () => {
    const plan = hitSchedule([
      { at: 1.4, strength: 2.5 },
      { at: 1.0, strength: 5 },
      { at: 2.0, strength: 9 },
    ]);
    expect(plan.map((h) => h.at)).toEqual([1.0, 1.4, 2.0]);
    expect(plan.map((h) => h.gain)).toEqual([1, 0.5, 1]);
  });

  it("아주 약하게 스친 것도 들릴 만큼은 울린다", () => {
    expect(hitSchedule([{ at: 0, strength: 0.1 }])[0]?.gain).toBeGreaterThanOrEqual(0.15);
  });

  it("한꺼번에 많이 부딪히면 겹쳐 울리는 소리는 정해진 개수까지만, 센 것부터 남긴다", () => {
    const burst = [1, 2, 3, 4, 5, 6].map((strength, i) => ({ at: 0.5 + i * 0.01, strength }));
    const plan = hitSchedule(burst);
    expect(MAX_VOICES).toBe(4);
    expect(plan.map((h) => h.at)).toEqual([0.52, 0.53, 0.54, 0.55]);
  });

  it("앞의 소리가 끝난 뒤의 부딪힘은 다시 울린다", () => {
    const first = [0, 0, 0, 0, 0].map((_, i) => ({ at: 0, strength: 5 - i * 0.1 }));
    const plan = hitSchedule([...first, { at: 0.5, strength: 1 }]);
    expect(plan).toHaveLength(MAX_VOICES + 1);
    expect(plan.at(-1)?.at).toBe(0.5);
  });
});
