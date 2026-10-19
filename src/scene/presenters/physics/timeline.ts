import { Euler, Quaternion } from "three";
import type { DieId } from "../../../engine/types";
import { BOARD, type Vec3 } from "../../../layout/board";
import { type RestInput, restPose } from "../../../layout/placement";
import { type CupPose, cupPose, POUR_TILT } from "./cup-pour";
import { type RollPlan, STEP_SECONDS } from "./pre-roll";
import { replayAt } from "./replay";

/**
 * 굴림 연출의 시간표(스펙 「굴림 연출」 세 단계). 시각(초)을 넣으면 그때 주사위와 컵의 자세를 돌려준다.
 * React·WebGL 없는 순수 계산이라 node 에서 테스트한다. 화면(physics-presenter.tsx)은 프레임마다 이것을 읽는다.
 *
 * 1. 컵: 정렬 줄의 주사위가 컵으로 날아 들어가고(gather), 컵이 흔들리다(shake) 옆으로 눕는다(pour).
 *    미리 굴리기가 아직 안 끝났으면 끝날 때까지 흔든다.
 * 2. 굴러감: 컵이 다 누운 순간 미리 굴린 궤적을 재생한다. 컵은 곧 제자리로 일어선다.
 * 3. 정렬: 멈춘 뒤 STOPPED_HOLD_S 동안 멈춘 자세를 보여 주고, 떠올라(rise) 정렬 자리로 간다.
 *    홀드 자리의 주사위는 그때까지 제자리에 있다가 같은 시간 동안 새 열로 옮긴다.
 */

/** 멈춘 뒤 떠오르기 전에 멈춘 자세를 보여 주는 시간(초). */
export const STOPPED_HOLD_S = 0.5;

/** 단계마다 걸리는 시간(초). */
export const TIMING = {
  /** 주사위 하나가 컵으로 날아 들어가는 시간. */
  gather: 0.35,
  /** 주사위마다 컵으로 출발하는 시각의 간격. */
  gatherStagger: 0.05,
  /** 쏟기 전에 적어도 흔드는 시간. */
  shake: 0.55,
  /** 컵이 눕는 시간. */
  pour: 0.25,
  /** 재생을 시작하고 컵이 일어서기 시작할 때까지. */
  cupReturnDelay: 0.3,
  /** 컵이 일어서는 시간. */
  cupReturn: 0.45,
  /** 떠올라 정렬 자리로 가는 시간. */
  rise: 0.55,
  /** 홀드·홀드 풀기, 3번째 굴림 뒤 홀드 자리로 올라가는 이동. */
  move: 0.35,
} as const;

/** 떠오를 때와 옮겨 갈 때 그리는 포물선의 꼭대기 높이(바닥 기준 더하는 값). */
const RISE_LIFT = 1.1;
const SHIFT_LIFT = 0.35;
const MOVE_LIFT = 0.45;

export interface ShownPose {
  position: Vec3;
  quaternion: Quaternion;
}

/** 정렬 줄·홀드 자리에 놓인 주사위의 자세. */
export function slotPose(die: RestInput): ShownPose {
  const { position, rotation } = restPose(die);
  return { position, quaternion: new Quaternion().setFromEuler(new Euler(...rotation)) };
}

/** 한 번의 굴림에서 주사위 하나가 어디서 어디로 가는지. */
export interface DieScript {
  id: DieId;
  /** 굴림 버튼을 누른 때 보이던 자세. */
  from: ShownPose;
  /** 정렬이 끝났을 때의 자세. */
  to: ShownPose;
}

export interface RollScript {
  /** 굴림 버튼을 누른 시각. */
  start: number;
  /** 컵에 넣어 굴리는 주사위. 미리 굴리기의 궤적과 같은 순서다. */
  rolling: readonly DieScript[];
  /** 홀드 자리의 주사위. */
  held: readonly DieScript[];
  /** 미리 굴리기 결과. 나오기 전에는 null. */
  plan: RollPlan | null;
  /** 컵을 쏟기 시작하는 시각. 미리 굴리기 결과가 나온 뒤 pourTime 으로 정한다. */
  pourAt: number | null;
}

/** 컵에 모으기를 다 끝내는 시각. */
function gatherEnd(script: RollScript): number {
  const last = Math.max(script.rolling.length - 1, 0);
  return script.start + TIMING.gather + last * TIMING.gatherStagger;
}

/** 미리 굴리기 결과가 `now` 에 나왔을 때 컵을 쏟기 시작할 시각. 모으기와 최소한의 흔들기 뒤다. */
export function pourTime(script: RollScript, now: number): number {
  return Math.max(now, gatherEnd(script) + TIMING.shake);
}

export interface RollFrame {
  dice: { id: DieId; position: Vec3; quaternion: Quaternion; visible: boolean }[];
  cup: CupPose;
  /** 주사위가 멈췄는지(멈춤 알림). */
  stopped: boolean;
  /** 정렬이 끝났는지(정렬 끝 알림). */
  linedUp: boolean;
}

export function rollFrame(script: RollScript, t: number): RollFrame {
  const { plan, pourAt } = script;
  const replayStart = pourAt === null ? null : pourAt + TIMING.pour;
  const duration = plan ? Math.max(plan.steps - 1, 0) * STEP_SECONDS : 0;
  const stopAt = replayStart === null ? null : replayStart + duration;
  const riseStart = stopAt === null ? null : stopAt + STOPPED_HOLD_S;
  const rise = riseStart === null ? 0 : progress(t, riseStart, TIMING.rise);

  const replay =
    plan && replayStart !== null && t >= replayStart ? replayAt(plan, t - replayStart) : null;

  const rolling = script.rolling.map((die, i) => {
    if (replay && riseStart !== null) {
      const at = replay.poses[i];
      if (!at) return { id: die.id, ...die.to, visible: true };
      if (t < riseStart)
        return { id: die.id, position: at.position, quaternion: at.quaternion, visible: true };
      return { id: die.id, ...tween(at, die.to, rise, RISE_LIFT), visible: true };
    }
    const departs = script.start + i * TIMING.gatherStagger;
    const k = progress(t, departs, TIMING.gather);
    if (k >= 1) return { id: die.id, ...die.from, visible: false };
    return { id: die.id, ...tween(die.from, intoCup(die.from), k, RISE_LIFT), visible: true };
  });

  const held = script.held.map((die) => ({
    id: die.id,
    // 열이 그대로면 제자리에 둔다(포물선으로 들썩이지 않게).
    ...(rise > 0 && !samePose(die.from, die.to)
      ? tween(die.from, die.to, rise, SHIFT_LIFT)
      : die.from),
    visible: true,
  }));

  return {
    dice: [...rolling, ...held],
    cup: cupAt(script, t),
    stopped: stopAt !== null && t >= stopAt,
    linedUp: riseStart !== null && rise >= 1,
  };
}

function samePose(a: ShownPose, b: ShownPose): boolean {
  return a.position.every((v, i) => v === b.position[i]) && a.quaternion.equals(b.quaternion);
}

/** 컵 입구 바로 안쪽. 주사위는 여기까지 날아가 숨는다. */
function intoCup(from: ShownPose): ShownPose {
  return {
    position: [BOARD.cup.x, BOARD.cup.height * 0.6, BOARD.cup.z],
    quaternion: from.quaternion,
  };
}

function cupAt(script: RollScript, t: number): CupPose {
  const still = { forward: 0, side: 0, lift: 0 };
  const shakeFrom = gatherEnd(script) - TIMING.gather * 0.4;
  if (t < shakeFrom) return cupPose(0, still);
  if (script.pourAt === null || t < script.pourAt) return cupPose(0, shake(t - shakeFrom));
  const tip = progress(t, script.pourAt, TIMING.pour);
  if (tip < 1) {
    const fade = 1 - tip;
    const wobble = shake(t - shakeFrom);
    return cupPose(POUR_TILT * ease(tip), {
      forward: wobble.forward * fade,
      side: wobble.side * fade,
      lift: wobble.lift * fade,
    });
  }
  const back = progress(t, script.pourAt + TIMING.pour + TIMING.cupReturnDelay, TIMING.cupReturn);
  return cupPose(POUR_TILT * (1 - ease(back)), still);
}

/** 흔들기: 앞뒤로 빠르게, 옆으로 조금, 살짝 들어 올린 채. */
function shake(elapsed: number) {
  const ramp = Math.min(elapsed / 0.12, 1);
  return {
    forward: 0.24 * ramp * Math.sin(elapsed * Math.PI * 2 * 4.5),
    side: 0.1 * ramp * Math.sin(elapsed * Math.PI * 2 * 3 + 1),
    lift: ramp * (0.14 + 0.05 * Math.sin(elapsed * Math.PI * 2 * 9)),
  };
}

export interface Move {
  from: ShownPose;
  to: ShownPose;
  /** 옮기기 시작한 시각. */
  start: number;
}

/** 굴림이 아닌 자리 바뀜(홀드·홀드 풀기, 3번째 굴림 뒤 올라감, 다음 턴에 내려옴). 같은 열이면 곧게 옮긴다. */
export function moveFrame(move: Move, t: number): { pose: ShownPose; done: boolean } {
  const k = progress(t, move.start, TIMING.move);
  return { pose: tween(move.from, move.to, k, MOVE_LIFT), done: k >= 1 };
}

/** `from` 에서 `to` 로 `k`(0~1)만큼. 위치는 부드럽게 출발·도착하며 위로 포물선을 그리고, 자세는 구면 보간한다. */
function tween(from: ShownPose, to: ShownPose, k: number, lift: number): ShownPose {
  if (k <= 0) return from;
  if (k >= 1) return to;
  const e = ease(k);
  const at = (i: 0 | 1 | 2) => from.position[i] + (to.position[i] - from.position[i]) * e;
  return {
    position: [at(0), at(1) + lift * Math.sin(Math.PI * e), at(2)],
    quaternion: from.quaternion.clone().slerp(to.quaternion, e),
  };
}

function progress(t: number, start: number, duration: number): number {
  return Math.min(Math.max((t - start) / duration, 0), 1);
}

/** 천천히 출발해 천천히 도착(3차 ease-in-out). */
function ease(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}
