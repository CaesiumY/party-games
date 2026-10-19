import { Euler, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { DieValue } from "../../../engine/types";
import { restPose } from "../../../layout/placement";
import { faceFix } from "./face-fix";
import { visibleTop } from "./visible-top.testing";

const VALUES: DieValue[] = [1, 2, 3, 4, 5, 6];
const Y = new Vector3(0, 1, 0);
const LOCAL_AXES = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];

/** 로컬 축 `axis` 가 위를 보고, 판 위에서 `yaw` 만큼 돌아 있으며, 살짝 기운 멈춘 자세. */
function restingOn(axis: Vector3, yaw: number, tilt = 0.05): Quaternion {
  return new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0.3).normalize(), tilt)
    .multiply(new Quaternion().setFromAxisAngle(Y, yaw))
    .multiply(new Quaternion().setFromUnitVectors(axis, Y));
}

describe("보이는 윗면 판정(테스트 도우미)", () => {
  it("정렬 자리의 자세(restPose)대로 놓으면 그 눈이 위로 보인다", () => {
    for (const value of VALUES) {
      const [x, y, z] = restPose({ value, held: false, column: 0 }).rotation;
      const q = new Quaternion().setFromEuler(new Euler(x, y, z));
      expect(visibleTop(q).value).toBe(value);
    }
  });
});

describe("면 맞추기", () => {
  it("어느 면으로 멈췄든, 맞춘 모델은 굴림 결과의 눈이 위로 보인다(6면 × 6눈 × 4방향)", () => {
    let checked = 0;
    LOCAL_AXES.forEach((axis, i) => {
      const rest = restingOn(axis, i * 0.7 + 0.2);
      for (const value of VALUES) {
        for (let quarter = 0; quarter < 4; quarter++) {
          const shown = rest.clone().multiply(faceFix(value, rest, quarter));
          expect(visibleTop(shown).value).toBe(value);
          checked++;
        }
      }
    });
    expect(checked).toBe(144);
  });

  it("맞추는 회전은 정육면체를 제자리에 겹치는 회전이라 모양이 물리 몸체와 어긋나지 않는다", () => {
    const rest = restingOn(new Vector3(0, 0, -1), 1.1);
    for (const value of VALUES) {
      for (let quarter = 0; quarter < 4; quarter++) {
        const fix = faceFix(value, rest, quarter);
        for (const axis of LOCAL_AXES) {
          const moved = axis.clone().applyQuaternion(fix);
          const components = [moved.x, moved.y, moved.z]
            .map((c) => Math.abs(c))
            .sort((a, b) => a - b);
          expect(components[0]).toBeCloseTo(0, 6);
          expect(components[1]).toBeCloseTo(0, 6);
          expect(components[2]).toBeCloseTo(1, 6);
        }
      }
    }
  });

  it("같은 눈이라도 방향을 바꾸면 다른 회전이 나온다(늘 같은 모습으로 멈추지 않게)", () => {
    const rest = restingOn(new Vector3(1, 0, 0), 0.4);
    const fixes = [0, 1, 2, 3].map((quarter) => faceFix(3, rest, quarter));
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        expect(Math.abs(fixes[a]?.dot(fixes[b] as Quaternion) ?? 1)).toBeLessThan(0.99);
      }
    }
  });
});
