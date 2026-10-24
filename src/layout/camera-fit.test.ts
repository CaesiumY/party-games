import { describe, expect, it } from "vitest";
import { boardCorners, cupCorners, holdRowCorners, lineupCorners } from "./board";
import { type FitInput, fitCamera, projectPoints, type Rect } from "./camera-fit";

function bounds(points: { x: number; y: number }[]): Rect {
  return {
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    bottom: Math.max(...points.map((p) => p.y)),
  };
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// 확인 크기 네 곳의 판 영역과 정사각형(실측에 가까운 값).
const cases: [string, FitInput][] = [
  [
    "세로 배치(휴대폰 375×667)",
    {
      width: 343,
      height: 300,
      reserveTop: 40,
      avoid: [{ left: 0, top: 254, right: 210, bottom: 300 }],
    },
  ],
  ["가로 배치(휴대폰 667×375)", { width: 400, height: 300, reserveTop: 34, avoid: [] }],
  [
    "가로 배치, 아래 가운데에 지금 차례 표시",
    {
      width: 400,
      height: 300,
      reserveTop: 34,
      avoid: [{ left: 150, top: 256, right: 250, bottom: 292 }],
    },
  ],
  ["가로 배치(데스크톱 1280×720)", { width: 820, height: 620, reserveTop: 34, avoid: [] }],
  ["정사각형", { width: 500, height: 500, reserveTop: 40, avoid: [] }],
  ["아주 납작한 판 영역", { width: 600, height: 180, reserveTop: 30, avoid: [] }],
];

describe("카메라 거리 맞춤", () => {
  it.each(cases)(
    "%s: 판 전체(테두리 높이 포함)와 컵이 판 영역 안, 위쪽 표시 자리 아래에 든다",
    (_, input) => {
      const fit = fitCamera(input);
      const all = projectPoints(fit, [...boardCorners(), ...cupCorners()]);

      for (const p of all) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(input.width);
        expect(p.y).toBeGreaterThanOrEqual(input.reserveTop);
        expect(p.y).toBeLessThanOrEqual(input.height);
      }
    },
  );

  it.each(cases)(
    "%s: 판 위에 겹친 것들이 컵, 정렬 줄의 주사위, 홀드 자리의 주사위를 가리지 않는다",
    (_, input) => {
      const fit = fitCamera(input);
      const guarded = [cupCorners(), lineupCorners(), holdRowCorners()].map((points) =>
        bounds(projectPoints(fit, points)),
      );

      for (const rect of input.avoid) {
        for (const box of guarded) expect(overlaps(box, rect)).toBe(false);
      }
    },
  );

  it("가로 배치: 판이 거의 줄지 않으면 판 전체(테두리 포함)가 아래 가운데의 지금 차례 표시를 피한다", () => {
    const input = cases[2]?.[1] as FitInput;
    const chip = input.avoid[0] as Rect;
    const fit = fitCamera(input);

    expect(overlaps(bounds(projectPoints(fit, [...boardCorners(), ...cupCorners()])), chip)).toBe(
      false,
    );
  });

  it("세로 배치: 판 전체가 버튼을 피하려면 판이 많이 줄어드니, 버튼이 판 앞쪽 테두리·펠트는 덮게 두고 판을 버튼이 없을 때의 95% 이상 크기로 그린다", () => {
    const input = cases[0]?.[1] as FitInput;
    const width = (fit: ReturnType<typeof fitCamera>) => {
      const box = bounds(projectPoints(fit, boardCorners()));
      return box.right - box.left;
    };

    const withButtons = width(fitCamera(input));
    const without = width(fitCamera({ ...input, avoid: [] }));

    expect(withButtons / without).toBeGreaterThanOrEqual(0.95);
  });

  it.each(cases)(
    "%s: 판을 쓸데없이 작게 그리지 않는다(가로나 세로로 남은 자리의 90% 이상)",
    (_, input) => {
      const fit = fitCamera(input);
      const box = bounds(projectPoints(fit, [...boardCorners(), ...cupCorners()]));
      // 남은 세로 자리: 위쪽 표시 자리 아래부터 가장 높이 올라온 겹친 것(버튼 등)의 위 끝까지.
      const floor = Math.min(input.height, ...input.avoid.map((r) => r.top));

      const widthUse = (box.right - box.left) / input.width;
      const heightUse = (box.bottom - box.top) / (floor - input.reserveTop);
      expect(Math.max(widthUse, heightUse)).toBeGreaterThanOrEqual(0.9);
    },
  );

  it("세로 배치: 왼쪽 아래 버튼 자리에 컵과 정렬 줄의 주사위가 겹치지 않는다", () => {
    const input = cases[0]?.[1] as FitInput;
    const button = input.avoid[0] as Rect;
    const fit = fitCamera(input);

    expect(overlaps(bounds(projectPoints(fit, cupCorners())), button)).toBe(false);
    expect(overlaps(bounds(projectPoints(fit, lineupCorners())), button)).toBe(false);
  });

  it("버튼 자리가 컵 바로 위에 오면 판을 더 멀리 두어서라도 컵을 피한다", () => {
    const base: FitInput = { width: 343, height: 300, reserveTop: 40, avoid: [] };
    const cupAt = bounds(projectPoints(fitCamera(base), cupCorners()));
    const blocker: Rect = {
      left: cupAt.left,
      top: cupAt.top,
      right: base.width,
      bottom: base.height,
    };

    const fit = fitCamera({ ...base, avoid: [blocker] });

    expect(overlaps(bounds(projectPoints(fit, cupCorners())), blocker)).toBe(false);
  });
});
