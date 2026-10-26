import { Quaternion, Vector3 } from "three";
import type { DieId, DieValue } from "../../../engine/types";
import { BOARD, columnX } from "../../../layout/board";
import { pourAxes, pourStart } from "./cup-pour";
import { faceFix } from "./face-fix";
import type { Rapier } from "./load-rapier";

/** 굴릴 주사위 하나. 눈은 이미 엔진이 정했다(ADR-0001). */
export interface RollingDie {
  id: DieId;
  value: DieValue;
}

export interface PreRollInput {
  /** 던지는 방향·회전을 정하는 시드. 같은 시드면 같은 궤적이다. */
  seed: number;
  rolling: readonly RollingDie[];
  /** 홀드 자리에 놓여 있는 주사위의 열. 굴리지 않고 장애물로 둔다. */
  heldColumns: readonly number[];
  /** 한 번 시뮬레이션의 최대 스텝(60 Hz). 넘기면 그 시드는 실패다. */
  maxSteps?: number;
  /** 실패하면 시드를 바꿔 다시 해 보는 최대 횟수. */
  maxTries?: number;
}

/** 주사위 하나의 궤적. 스텝마다 위치 x, y, z 와 자세 qx, qy, qz, qw 의 7개 값. */
export interface DieTrack {
  id: DieId;
  frames: Float32Array;
  /** 면 맞추기 회전. 화면 자세는 모든 프레임에서 `기록한 자세 · fix` 다. */
  fix: Quaternion;
}

/**
 * 주사위가 무언가(바닥·벽·다른 주사위·홀드 자리의 주사위)에 부딪힌 순간. 충돌음을 이 시점에 낸다.
 * `step` 은 궤적의 프레임 번호(재생을 시작하고 `step * STEP_SECONDS` 초 뒤), `strength` 는 그 스텝에
 * 중력으로는 설명되지 않게 바뀐 속도의 크기(초속, 판 단위)다.
 */
export interface Collision {
  die: DieId;
  step: number;
  strength: number;
}

/** 미리 굴린 결과. 모든 궤적은 같은 스텝 수다. */
export interface RollPlan {
  steps: number;
  tracks: DieTrack[];
  /** 재생하는 구간 안의 부딪힘. 스텝 순서. */
  collisions: Collision[];
}

export type RestProblem = "out" | "cup" | "stacked" | "edge";

/** 시뮬레이션 한 스텝의 길이(초). 재생도 이 간격으로 프레임을 읽는다. */
export const STEP_SECONDS = 1 / 60;

/** 한 스텝 기록의 값 개수(위치 3 + 자세 4). */
const FRAME = 7;
const GRAVITY = -9.81 * 2;
/** 주사위 모델(RoundedBoxGeometry)의 모서리 반지름. die-mesh.tsx 와 같다. */
const DIE_CORNER = 0.1;
/** 물리 벽 높이. 보이는 테두리보다 훨씬 높게 해 주사위가 판 밖으로 튀어 나가지 않게 한다. */
const WALL_HALF_HEIGHT = 3;
/** 이만큼 연속으로 모든 주사위가 거의 움직이지 않으면 멈춤으로 본다. */
const STILL_STEPS = 20;
const STILL_LINEAR = 0.02;
const STILL_ANGULAR = 0.05;
/** 한 스텝에 중력 말고 이만큼(초속) 넘게 속도가 바뀌면 부딪힌 것으로 본다. 구르며 바닥을 스치는 것은 빠진다. */
const HIT_MIN_SPEED_CHANGE = 0.8;
/** 한 번 부딪힘이 여러 스텝에 걸쳐 풀리므로, 같은 주사위는 이 스텝 수 안에 다시 세지 않는다. */
const HIT_REPEAT_STEPS = 4;

/**
 * 멈춘 자세가 정렬 전에 보여 주기에 알맞은지. 문제가 있으면 그 시드를 버리고 다시 굴린다.
 * - out: 판 밖, cup: 쏟은 뒤 제자리로 돌아온 컵 아래(컵은 물리에 넣지 않는다)
 * - stacked: 다른 주사위·벽에 기대 떠 있음, edge: 모서리로 섬
 */
export function restProblem(
  position: { x: number; y: number; z: number },
  rotation: Quaternion,
): RestProblem | null {
  const half = BOARD.die / 2;
  if (
    Math.abs(position.x) > BOARD.width / 2 - half + 0.01 ||
    Math.abs(position.z) > BOARD.depth / 2 - half + 0.01
  ) {
    return "out";
  }
  if (Math.hypot(position.x - BOARD.cup.x, position.z - BOARD.cup.z) < BOARD.cup.radius + half) {
    return "cup";
  }
  if (Math.abs(position.y - half) > 0.03) return "stacked";
  if (flatness(rotation) < 0.99) return "edge";
  return null;
}

/** 가장 위를 향한 면 법선이 얼마나 곧게 위를 보는지(1 이면 반듯이 놓임). */
function flatness(rotation: Quaternion): number {
  const up = new Vector3(0, 1, 0).applyQuaternion(rotation.clone().invert());
  return Math.max(Math.abs(up.x), Math.abs(up.y), Math.abs(up.z));
}

/**
 * 화면 밖에서 굴림을 미리 시뮬레이션한다(스펙 「굴림 연출」 2단계). 궤적과 멈춘 자세를 얻고,
 * 멈췄을 때 굴림 결과의 눈이 위로 보이도록 주사위마다 면 맞추기 회전을 구한다.
 * 멈춘 자세가 알맞지 않으면 시드를 바꿔 다시 하고, 끝내 안 되면 null(물리 없이 놓기)을 돌려준다.
 * 멈춘 면은 면 맞추기에만 쓰고 점수에는 쓰지 않는다(ADR-0001).
 */
export function preRoll(rapier: Rapier, input: PreRollInput): RollPlan | null {
  const tries = input.maxTries ?? 5;
  for (let attempt = 0; attempt < tries; attempt++) {
    const plan = simulateOnce(rapier, input, (input.seed + attempt * 0x9e3779b9) >>> 0);
    if (plan) return plan;
  }
  return null;
}

function simulateOnce(rapier: Rapier, input: PreRollInput, seed: number): RollPlan | null {
  const random = mulberry32(seed);
  const maxSteps = input.maxSteps ?? 600;
  const world = new rapier.World({ x: 0, y: GRAVITY, z: 0 });
  try {
    world.timestep = STEP_SECONDS;
    buildBoard(rapier, world, input.heldColumns);
    const bodies = input.rolling.map((_, i) => throwDie(rapier, world, random, i));

    const frames = bodies.map(() => [] as number[]);
    const hits = collisionRecorder(input.rolling, bodies);
    let still = 0;
    let steps = 0;
    while (steps < maxSteps && still < STILL_STEPS) {
      world.step();
      steps++;
      hits.afterStep(steps - 1);
      let moving = false;
      bodies.forEach((body, i) => {
        const t = body.translation();
        const r = body.rotation();
        frames[i]?.push(t.x, t.y, t.z, r.x, r.y, r.z, r.w);
        if (
          !body.isSleeping() &&
          (length(body.linvel()) > STILL_LINEAR || length(body.angvel()) > STILL_ANGULAR)
        ) {
          moving = true;
        }
      });
      still = moving ? 0 : still + 1;
    }
    if (still < STILL_STEPS) return null;

    // 멈춤을 확인하느라 더 돌린 구간은 재생하지 않는다. 궤적은 모든 주사위가 처음 멈춘 스텝에서 끝나고,
    // 멈춘 자세 검사와 면 맞추기도 화면에 마지막으로 보이는 그 프레임으로 한다.
    const shownSteps = steps - STILL_STEPS + 1;
    const end = shownSteps * FRAME;
    const tracks: DieTrack[] = [];
    for (const [i, die] of input.rolling.entries()) {
      const shown = Float32Array.from((frames[i] ?? []).slice(0, end));
      const at = (k: number) => shown[end - FRAME + k] ?? 0;
      const rest = new Quaternion(at(3), at(4), at(5), at(6));
      if (restProblem({ x: at(0), y: at(1), z: at(2) }, rest)) return null;
      tracks.push({
        id: die.id,
        frames: shown,
        fix: faceFix(die.value, rest, Math.floor(random() * 4)),
      });
    }
    return {
      steps: shownSteps,
      tracks,
      collisions: hits.collisions.filter((c) => c.step < shownSteps),
    };
  } finally {
    world.free();
  }
}

type World = InstanceType<Rapier["World"]>;
type Body = ReturnType<World["createRigidBody"]>;

/**
 * 스텝마다 주사위의 속도 변화로 부딪힘을 찾는다. 떨어지는 동안의 속도 변화(중력)와 가만히 놓인 동안의
 * 변화(0)는 빼고 남은 크기가 기준을 넘으면 부딪힘이다. 바닥·벽·주사위 어느 것에 부딪혔는지는 가리지 않는다.
 */
function collisionRecorder(dice: readonly RollingDie[], bodies: readonly Body[]) {
  const collisions: Collision[] = [];
  const before = bodies.map((body) => ({ ...body.linvel() }));
  const lastHit = bodies.map(() => -Infinity);
  const gravityStep = GRAVITY * STEP_SECONDS;
  return {
    collisions,
    afterStep(step: number) {
      bodies.forEach((body, i) => {
        const v = body.linvel();
        const prev = before[i];
        const die = dice[i];
        if (!prev || !die) return;
        // 잠든(가만히 놓인) 주사위는 중력도 받지 않으므로 기대 변화가 0 이다.
        const expectedY = body.isSleeping() ? 0 : gravityStep;
        const change = Math.hypot(v.x - prev.x, v.y - prev.y - expectedY, v.z - prev.z);
        if (change > HIT_MIN_SPEED_CHANGE && step - (lastHit[i] ?? 0) >= HIT_REPEAT_STEPS) {
          collisions.push({ die: die.id, step, strength: change });
          lastHit[i] = step;
        }
        before[i] = { x: v.x, y: v.y, z: v.z };
      });
    },
  };
}

/** 바닥, 높은 벽 네 개, 홀드 자리의 주사위(고정 장애물). */
function buildBoard(rapier: Rapier, world: World, heldColumns: readonly number[]) {
  const { width: w, depth: d, die } = BOARD;
  const fixed = (hx: number, hy: number, hz: number, x: number, y: number, z: number) =>
    world.createCollider(
      rapier.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setFriction(0.6)
        .setRestitution(0.3),
    );
  const h = WALL_HALF_HEIGHT;
  fixed(w / 2, 0.5, d / 2, 0, -0.5, 0);
  fixed(0.5, h, d / 2, -w / 2 - 0.5, h, 0);
  fixed(0.5, h, d / 2, w / 2 + 0.5, h, 0);
  fixed(w / 2, h, 0.5, 0, h, -d / 2 - 0.5);
  fixed(w / 2, h, 0.5, 0, h, d / 2 + 0.5);
  for (const column of heldColumns) {
    fixed(die / 2, die / 2, die / 2, columnX(column), die / 2, BOARD.holdRowZ);
  }
}

/**
 * 다 쏟은 컵(옆으로 누움)의 입구에서 판 가운데 쪽으로 던진다(cup-pour.ts).
 * 주사위끼리 자리를 띄워 처음부터 겹치지 않게 한다.
 */
function throwDie(rapier: Rapier, world: World, random: () => number, index: number) {
  const axis = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
  const rotation = new Quaternion().setFromAxisAngle(axis, random() * Math.PI * 2);
  const [x, y, z] = pourStart(index);
  const jitter = () => (random() - 0.5) * 0.08;
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(x + jitter(), y + jitter(), z + jitter())
      .setRotation(rotation)
      .setCcdEnabled(true)
      .setLinearDamping(0.1)
      .setAngularDamping(0.1),
  );
  const core = BOARD.die / 2 - DIE_CORNER;
  world.createCollider(
    rapier.ColliderDesc.roundCuboid(core, core, core, DIE_CORNER)
      .setDensity(1)
      .setFriction(0.5)
      .setRestitution(0.35),
    body,
  );
  const { forward, side } = pourAxes();
  const speed = 4 + random() * 2.5;
  const spread = (random() - 0.5) * 2.4;
  body.setLinvel(
    {
      x: forward[0] * speed + side[0] * spread,
      y: 0.5 + random(),
      z: forward[2] * speed + side[2] * spread,
    },
    true,
  );
  body.setAngvel(
    { x: (random() - 0.5) * 30, y: (random() - 0.5) * 30, z: (random() - 0.5) * 30 },
    true,
  );
  return body;
}

function length(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** 시드 있는 32비트 난수(mulberry32). 굴림 결과가 아니라 던지는 모양에만 쓴다. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
