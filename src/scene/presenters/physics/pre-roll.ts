import { Quaternion, Vector3 } from "three";
import type { DieId, DieValue } from "../../../engine/types";
import { BOARD, columnX } from "../../../layout/board";
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

/** 미리 굴린 결과. 모든 궤적은 같은 스텝 수다. */
export interface RollPlan {
  steps: number;
  tracks: DieTrack[];
}

export type RestProblem = "out" | "stacked" | "edge";

/** 시뮬레이션 한 스텝의 길이(초). 재생도 이 간격으로 프레임을 읽는다. */
export const STEP_SECONDS = 1 / 60;

const GRAVITY = -9.81 * 2;
/** 주사위 모델(RoundedBoxGeometry)의 모서리 반지름. die-mesh.tsx 와 같다. */
const DIE_CORNER = 0.1;
/** 물리 벽 높이. 보이는 테두리보다 훨씬 높게 해 주사위가 판 밖으로 튀어 나가지 않게 한다. */
const WALL_HALF_HEIGHT = 3;
/** 이만큼 연속으로 모든 주사위가 거의 움직이지 않으면 멈춤으로 본다. */
const STILL_STEPS = 20;
const STILL_LINEAR = 0.02;
const STILL_ANGULAR = 0.05;

/**
 * 멈춘 자세가 정렬 전에 보여 주기에 알맞은지. 문제가 있으면 그 시드를 버리고 다시 굴린다.
 * - out: 판 밖, stacked: 다른 주사위·벽에 기대 떠 있음, edge: 모서리로 섬
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
    let still = 0;
    let steps = 0;
    while (steps < maxSteps && still < STILL_STEPS) {
      world.step();
      steps++;
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

    const tracks: DieTrack[] = [];
    for (const [i, die] of input.rolling.entries()) {
      const body = bodies[i];
      if (!body) return null;
      const r = body.rotation();
      const rest = new Quaternion(r.x, r.y, r.z, r.w);
      if (restProblem(body.translation(), rest)) return null;
      tracks.push({
        id: die.id,
        frames: Float32Array.from(frames[i] ?? []),
        fix: faceFix(die.value, rest, Math.floor(random() * 4)),
      });
    }
    return { steps, tracks };
  } finally {
    world.free();
  }
}

type World = InstanceType<Rapier["World"]>;

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

/** 컵 입구 근처에서 판 가운데 쪽으로 던진다. 주사위끼리 높이를 달리해 처음부터 겹치지 않게 한다. */
function throwDie(rapier: Rapier, world: World, random: () => number, index: number) {
  const axis = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
  const rotation = new Quaternion().setFromAxisAngle(axis, random() * Math.PI * 2);
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(
        BOARD.cup.x + (random() - 0.5) * 0.6,
        1.2 + index * 0.85,
        BOARD.cup.z + (random() - 0.5) * 0.6,
      )
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
  body.setLinvel({ x: -3 - random() * 2.5, y: 0.5 + random(), z: -4 - random() * 3 }, true);
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
