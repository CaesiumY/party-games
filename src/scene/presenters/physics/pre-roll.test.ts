import { Quaternion, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";
import type { DieId, DieValue } from "../../../engine/types";
import { BOARD, columnX } from "../../../layout/board";
import { loadRapier, type Rapier } from "./load-rapier";
import { type DieTrack, preRoll, restProblem } from "./pre-roll";
import { visibleTop } from "./visible-top.testing";

let rapier: Rapier;
beforeAll(async () => {
  rapier = await loadRapier();
});

const ALL: DieId[] = [0, 1, 2, 3, 4];
const FRAME = 7;

/** 마지막 프레임의 위치와, 면 맞추기를 곱한 화면 자세. */
function shownAtRest(track: DieTrack) {
  const f = track.frames;
  const i = f.length - FRAME;
  const position = { x: f[i] ?? 0, y: f[i + 1] ?? 0, z: f[i + 2] ?? 0 };
  const recorded = new Quaternion(f[i + 3], f[i + 4], f[i + 5], f[i + 6]);
  return { position, quaternion: recorded.multiply(track.fix) };
}

function outcome(seed: number, ids: readonly DieId[]): { id: DieId; value: DieValue }[] {
  return ids.map((id, k) => ({ id, value: (((seed * 7 + k * 3) % 6) + 1) as DieValue }));
}

describe("미리 굴리기", () => {
  it("같은 시드면 같은 궤적이 나온다", () => {
    const input = { seed: 42, rolling: outcome(1, ALL), heldColumns: [] };
    const a = preRoll(rapier, input);
    const b = preRoll(rapier, input);
    expect(a).not.toBeNull();
    expect(a?.tracks.map((t) => Array.from(t.frames))).toEqual(
      b?.tracks.map((t) => Array.from(t.frames)),
    );
  });

  it("멈춘 뒤 위를 향한 면이 굴림 결과와 같고, 판 안 바닥에 반듯이 놓인다(200번)", () => {
    const limit = BOARD.width / 2 - BOARD.die / 2 + 0.02;
    const limitZ = BOARD.depth / 2 - BOARD.die / 2 + 0.02;
    for (let seed = 1; seed <= 200; seed++) {
      const rolling = outcome(seed, ALL);
      const plan = preRoll(rapier, { seed: seed * 7919, rolling, heldColumns: [] });
      expect(plan, `시드 ${seed}`).not.toBeNull();
      plan?.tracks.forEach((track, k) => {
        expect(track.id).toBe(rolling[k]?.id);
        const { position, quaternion } = shownAtRest(track);
        const top = visibleTop(quaternion);
        expect(top.value, `시드 ${seed} 주사위 ${track.id}`).toBe(rolling[k]?.value);
        expect(top.tilt).toBeGreaterThan(0.99);
        expect(Math.abs(position.y - BOARD.die / 2)).toBeLessThan(0.03);
        expect(Math.abs(position.x)).toBeLessThan(limit);
        expect(Math.abs(position.z)).toBeLessThan(limitZ);
      });
    }
  });

  it("홀드 자리의 주사위는 굴리지 않고, 굴린 주사위는 그 자리를 뚫고 지나가지 않는다", () => {
    const heldColumns = [0, 1, 2];
    for (let seed = 1; seed <= 30; seed++) {
      const rolling = outcome(seed, [3, 4]);
      const plan = preRoll(rapier, { seed, rolling, heldColumns });
      expect(plan).not.toBeNull();
      expect(plan?.tracks.map((t) => t.id)).toEqual([3, 4]);
      for (const track of plan?.tracks ?? []) {
        expect(visibleTop(shownAtRest(track).quaternion).value).toBe(
          rolling.find((d) => d.id === track.id)?.value,
        );
        for (let i = 0; i < track.frames.length; i += FRAME) {
          const x = track.frames[i] ?? 0;
          const z = track.frames[i + 2] ?? 0;
          for (const column of heldColumns) {
            const inside =
              Math.abs(x - columnX(column)) < BOARD.die * 0.7 &&
              Math.abs(z - BOARD.holdRowZ) < BOARD.die * 0.7 &&
              (track.frames[i + 1] ?? 0) < BOARD.die;
            expect(inside).toBe(false);
          }
        }
      }
    }
  });

  it("정해진 시간 안에 멈추지 못하면 새 시드로 다시 해 보고, 끝내 안 되면 물리 없이 놓도록 알린다", () => {
    const plan = preRoll(rapier, {
      seed: 3,
      rolling: outcome(3, ALL),
      heldColumns: [],
      maxSteps: 5,
    });
    expect(plan).toBeNull();
  });
});

describe("멈춘 자세 검사", () => {
  const flat = new Quaternion();
  const onFloor = { x: 0, y: BOARD.die / 2, z: 0 };

  it("판 안 바닥에 한 면으로 놓이면 문제없다", () => {
    expect(restProblem(onFloor, flat)).toBeNull();
  });

  it("모서리로 서면 다시 굴린다", () => {
    const onEdge = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4);
    expect(restProblem({ ...onFloor, y: BOARD.die * 0.7 }, onEdge)).not.toBeNull();
    expect(restProblem(onFloor, onEdge)).toBe("edge");
  });

  it("다른 주사위나 벽에 기대 떠 있으면 다시 굴린다", () => {
    expect(restProblem({ ...onFloor, y: BOARD.die * 1.5 }, flat)).toBe("stacked");
  });

  it("판 밖으로 나가면 다시 굴린다", () => {
    expect(restProblem({ ...onFloor, x: BOARD.width }, flat)).toBe("out");
  });
});
