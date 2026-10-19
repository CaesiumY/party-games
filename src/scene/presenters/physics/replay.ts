import { Quaternion } from "three";
import type { DieId } from "../../../engine/types";
import type { Vec3 } from "../../../layout/board";
import { type RollPlan, STEP_SECONDS } from "./pre-roll";

export interface ReplayPose {
  id: DieId;
  position: Vec3;
  /** 화면에 그릴 자세. 기록한 자세에 면 맞추기 회전을 곱한 것이다. */
  quaternion: Quaternion;
}

const FRAME = 7;

/**
 * 미리 굴린 궤적을 재생 시작 뒤 `seconds` 초 시점에서 읽는다. 프레임 사이는 위치를 선형으로,
 * 자세를 구면 보간으로 잇고, 모든 프레임에 같은 면 맞추기 회전을 곱한다(멈출 때 눈이 튀지 않게).
 * 마지막 프레임에 닿으면 `done` 이고, 그 뒤로는 멈춘 자세에 머문다.
 */
export function replayAt(plan: RollPlan, seconds: number): { poses: ReplayPose[]; done: boolean } {
  const last = plan.steps - 1;
  const cursor = Math.min(Math.max(seconds / STEP_SECONDS, 0), last);
  const from = Math.floor(cursor);
  const to = Math.min(from + 1, last);
  const t = cursor - from;
  const poses = plan.tracks.map(({ id, frames, fix }) => {
    const a = from * FRAME;
    const b = to * FRAME;
    const at = (i: number) => frames[i] ?? 0;
    const lerp = (k: number) => at(a + k) + (at(b + k) - at(a + k)) * t;
    const qa = new Quaternion(at(a + 3), at(a + 4), at(a + 5), at(a + 6));
    const qb = new Quaternion(at(b + 3), at(b + 4), at(b + 5), at(b + 6));
    return {
      id,
      position: [lerp(0), lerp(1), lerp(2)] as const,
      quaternion: qa.slerp(qb, t).multiply(fix),
    };
  });
  return { poses, done: cursor >= last };
}
