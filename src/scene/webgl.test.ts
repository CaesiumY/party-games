import { describe, expect, it } from "vitest";
import { hasWebGL } from "./webgl";

function fakeDocument(contexts: Record<string, unknown>): Document {
  return {
    createElement: () => ({
      getContext: (kind: string) => contexts[kind] ?? null,
    }),
  } as unknown as Document;
}

describe("hasWebGL", () => {
  it("WebGL 2 를 쓸 수 있으면 3D 를 그린다", () => {
    expect(hasWebGL(fakeDocument({ webgl2: {} }))).toBe(true);
  });

  it("WebGL 1 만 있으면 three.js 가 그리지 못하므로 지원하지 않는다", () => {
    expect(hasWebGL(fakeDocument({ webgl: {} }))).toBe(false);
  });

  it("둘 다 없으면 지원하지 않는다", () => {
    expect(hasWebGL(fakeDocument({}))).toBe(false);
  });

  it("캔버스를 만들다 오류가 나면 지원하지 않는다", () => {
    const doc = {
      createElement: () => {
        throw new Error("no canvas");
      },
    } as unknown as Document;
    expect(hasWebGL(doc)).toBe(false);
  });
});
