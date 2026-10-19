import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { RollPlan } from "./pre-roll";
import { replayAt } from "./replay";

const quarterTurnY = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

/** 손으로 만든 3스텝 궤적: x 가 0 → 1 → 2 로 가고, 자세는 처음에 그대로였다가 y 축으로 90° 돈다. */
const plan: RollPlan = {
  steps: 3,
  tracks: [
    {
      id: 2,
      // biome-ignore format: 한 줄이 한 스텝
      frames: Float32Array.from([
        0, 1, 0, 0, 0, 0, 1,
        1, 1, 0, 0, 0, 0, 1,
        2, 0.39, 0, quarterTurnY.x, quarterTurnY.y, quarterTurnY.z, quarterTurnY.w,
      ]),
      fix: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI),
    },
  ],
};
const fix = plan.tracks[0]?.fix as Quaternion;
const step = 1 / 60;

describe("궤적 재생", () => {
  it("시작하면 첫 프레임 자리에 있고, 모델에는 면 맞추기 회전이 곱해져 있다", () => {
    const { poses, done } = replayAt(plan, 0);
    expect(done).toBe(false);
    expect(poses[0]?.id).toBe(2);
    expect(poses[0]?.position).toEqual([0, 1, 0]);
    expect(poses[0]?.quaternion.angleTo(fix)).toBeCloseTo(0, 5);
  });

  it("프레임 사이에서는 위치와 자세를 이어서 보간한다", () => {
    const { poses } = replayAt(plan, step * 1.5);
    const [x, y] = poses[0]?.position ?? [];
    expect(x).toBeCloseTo(1.5, 5);
    expect(y).toBeCloseTo((1 + 0.39) / 2, 5);
    const halfTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
    expect(poses[0]?.quaternion.angleTo(halfTurn.multiply(fix))).toBeCloseTo(0, 3);
  });

  it("마지막 프레임에 닿으면 끝나고, 그 뒤로는 멈춘 자세에 머문다", () => {
    expect(replayAt(plan, step * 1.99).done).toBe(false);
    for (const t of [step * 2, 10]) {
      const { poses, done } = replayAt(plan, t);
      expect(done).toBe(true);
      expect(poses[0]?.position[0]).toBeCloseTo(2, 5);
      expect(poses[0]?.quaternion.angleTo(quarterTurnY.clone().multiply(fix))).toBeCloseTo(0, 3);
    }
  });
});
