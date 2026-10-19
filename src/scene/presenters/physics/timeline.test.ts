import { Quaternion } from "three";
import { describe, expect, it } from "vitest";
import { BOARD, columnX } from "../../../layout/board";
import { POUR_TILT } from "./cup-pour";
import type { RollPlan } from "./pre-roll";
import { STEP_SECONDS } from "./pre-roll";
import {
  type DieScript,
  moveFrame,
  pourTime,
  type RollScript,
  rollFrame,
  STOPPED_HOLD_S,
  slotPose,
  TIMING,
} from "./timeline";

/** 한 곳에서 다른 곳으로 미끄러지는 세 스텝짜리 가짜 궤적. 정렬 자리와 다른 곳에 멈춘다. */
function fakePlan(ids: number[]): RollPlan {
  return {
    steps: 3,
    tracks: ids.map((id) => ({
      id: id as 0,
      frames: Float32Array.from([
        ...[1, 0.6, 1.6, 0, 0, 0, 1],
        ...[0, 0.5, 0, 0, 0, 0, 1],
        ...[-1, BOARD.die / 2, -1, 0, 0, 0, 1],
      ]),
      fix: new Quaternion(),
    })),
  };
}

const lineupDie = (id: 0 | 1 | 2 | 3 | 4, column: number): DieScript => ({
  id,
  from: slotPose({ value: 3, held: false, column }),
  to: slotPose({ value: 5, held: false, column: 4 - column }),
});
const heldDie: DieScript = {
  id: 4,
  from: slotPose({ value: 6, held: true, column: 2 }),
  to: slotPose({ value: 6, held: true, column: 0 }),
};

function script(plan: RollPlan | null): RollScript {
  const s: RollScript = {
    start: 10,
    rolling: [lineupDie(0, 0), lineupDie(1, 1)],
    held: [heldDie],
    plan,
    pourAt: null,
  };
  if (plan) s.pourAt = pourTime(s, s.start);
  return s;
}

const pourAt = (s: RollScript) => s.pourAt ?? Number.NaN;
const replayStart = (s: RollScript) => pourAt(s) + TIMING.pour;
const stopAt = (s: RollScript) => replayStart(s) + 2 * STEP_SECONDS;
const lineupEnd = (s: RollScript) => stopAt(s) + STOPPED_HOLD_S + TIMING.rise;
/** 궤적은 Float32Array 라 소수 여섯째 자리까지만 비교한다. */
function expectNear(actual: readonly number[] | undefined, expected: readonly number[]) {
  expected.forEach((v, i) => {
    expect(actual?.[i]).toBeCloseTo(v, 5);
  });
}
const poseOf = (frame: ReturnType<typeof rollFrame>, id: number) =>
  frame.dice.find((d) => d.id === id);

describe("굴림 연출 시간표", () => {
  it("컵에 모으기와 흔들기를 다 한 뒤에 쏟는다", () => {
    const s = script(fakePlan([0, 1]));
    expect(pourAt(s)).toBeGreaterThanOrEqual(s.start + TIMING.gather + TIMING.shake);
  });

  it("미리 굴리기가 늦어지면 쏟지 않고 컵을 계속 흔들며, 주사위는 컵 안에 숨어 있다", () => {
    const s = script(null);
    const late = rollFrame(s, s.start + 5);
    expect(late.dice.filter((d) => d.id !== 4).every((d) => !d.visible)).toBe(true);
    expect(late.stopped).toBe(false);
    expect(late.cup.position[1]).toBeGreaterThan(0);
  });

  it("컵과 굴러감 동안 홀드 자리의 주사위는 움직이지 않고, 정렬 때 새 열로 옮긴다", () => {
    const s = script(fakePlan([0, 1]));
    for (const t of [s.start, s.start + 0.3, pourAt(s), replayStart(s), stopAt(s)]) {
      expect(poseOf(rollFrame(s, t), 4)?.position).toEqual(heldDie.from.position);
    }
    expect(poseOf(rollFrame(s, lineupEnd(s)), 4)?.position).toEqual(heldDie.to.position);
  });

  it("열이 그대로인 홀드 자리의 주사위는 정렬 때도 움직이지 않는다", () => {
    const stays: DieScript = { id: 3, from: heldDie.to, to: heldDie.to };
    const s: RollScript = { ...script(fakePlan([0, 1])), held: [stays] };
    for (const t of [stopAt(s) + STOPPED_HOLD_S + TIMING.rise / 2, lineupEnd(s)]) {
      expect(poseOf(rollFrame(s, t), 3)?.position).toEqual(stays.from.position);
    }
  });

  it("굴린 주사위는 컵에 들어가 숨었다가, 컵이 다 누운 순간 궤적의 첫 자세로 나온다", () => {
    const s = script(fakePlan([0, 1]));
    expect(poseOf(rollFrame(s, s.start), 0)?.position).toEqual(lineupDie(0, 0).from.position);
    expect(poseOf(rollFrame(s, pourAt(s)), 0)?.visible).toBe(false);

    const out = rollFrame(s, replayStart(s));
    expect(poseOf(out, 0)?.visible).toBe(true);
    expectNear(poseOf(out, 0)?.position, [1, 0.6, 1.6]);
    expect(out.cup.quaternion.angleTo(new Quaternion())).toBeCloseTo(POUR_TILT, 5);
  });

  it("궤적이 끝나면 멈춤, 0.5초 머문 뒤 떠올라 정렬 자리에 닿으면 정렬 끝이다", () => {
    const s = script(fakePlan([0, 1]));
    expect(rollFrame(s, stopAt(s) - 0.001).stopped).toBe(false);
    const stopped = rollFrame(s, stopAt(s));
    expect(stopped.stopped).toBe(true);
    expectNear(poseOf(rollFrame(s, stopAt(s) + STOPPED_HOLD_S), 0)?.position, [
      -1,
      BOARD.die / 2,
      -1,
    ]);
    const rising = rollFrame(s, stopAt(s) + STOPPED_HOLD_S + TIMING.rise / 2);
    expect(rising.linedUp).toBe(false);
    expect(poseOf(rising, 0)?.position[1]).toBeGreaterThan(BOARD.die);

    const end = rollFrame(s, lineupEnd(s));
    expect(end.linedUp).toBe(true);
    expect(poseOf(end, 0)?.position).toEqual(lineupDie(0, 0).to.position);
    expect(poseOf(end, 0)?.quaternion.angleTo(lineupDie(0, 0).to.quaternion)).toBeCloseTo(0, 5);
    expect(end.cup.quaternion.angleTo(new Quaternion())).toBeCloseTo(0, 5);
  });
});

describe("홀드 이동", () => {
  const from = slotPose({ value: 2, held: false, column: 3 });
  const to = slotPose({ value: 2, held: true, column: 3 });

  it("같은 열의 홀드 자리로 곧게 옮겨 가고, 끝나면 그 자리에 놓인다", () => {
    const move = { from, to, start: 1 };
    for (const k of [0, 0.25, 0.5, 0.75]) {
      const frame = moveFrame(move, 1 + k * TIMING.move);
      expect(frame.done).toBe(false);
      expect(frame.pose.position[0]).toBeCloseTo(columnX(3), 6);
    }
    const end = moveFrame(move, 1 + TIMING.move);
    expect(end.done).toBe(true);
    expect(end.pose.position).toEqual([columnX(3), BOARD.die / 2, BOARD.holdRowZ]);
  });
});
