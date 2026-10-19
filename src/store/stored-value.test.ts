import { describe, expect, it } from "vitest";
import { createStoredValue, type KeyValueStorage, memoryStorage } from "./stored-value";

const isCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

describe("브라우저 저장 도우미", () => {
  it("쓴 값을 그대로 읽고, 지우면 다시 비어 있다", () => {
    const storage = memoryStorage();
    const item = createStoredValue({ storage, key: "count", version: 1, parse: isCount });
    expect(item.read()).toBeNull();

    item.write(7);
    expect(item.read()).toBe(7);
    expect(createStoredValue({ storage, key: "count", version: 1, parse: isCount }).read()).toBe(7);

    item.clear();
    expect(item.read()).toBeNull();
  });

  it("버전이 다른 항목은 버리고, 다른 항목은 건드리지 않는다", () => {
    const storage = memoryStorage();
    createStoredValue({ storage, key: "count", version: 1, parse: isCount }).write(7);
    createStoredValue({ storage, key: "other", version: 3, parse: isCount }).write(9);

    const upgraded = createStoredValue({ storage, key: "count", version: 2, parse: isCount });

    expect(upgraded.read()).toBeNull();
    expect(storage.getItem("count")).toBeNull();
    expect(createStoredValue({ storage, key: "other", version: 3, parse: isCount }).read()).toBe(9);
  });

  it("읽을 수 없는 항목(깨진 글자, 형식이 맞지 않는 값)은 버린다", () => {
    const storage = memoryStorage();
    storage.setItem("broken", "{not json");
    storage.setItem("wrong", JSON.stringify({ version: 1, value: "열" }));
    storage.setItem("bare", "7");

    for (const key of ["broken", "wrong", "bare"]) {
      expect(createStoredValue({ storage, key, version: 1, parse: isCount }).read()).toBeNull();
      expect(storage.getItem(key)).toBeNull();
    }
  });

  it("브라우저 저장소를 쓸 수 없어도(사생활 보호 모드 등) 예외 없이 비어 있는 것으로 다룬다", () => {
    const failing: KeyValueStorage = {
      getItem: () => {
        throw new Error("막힘");
      },
      setItem: () => {
        throw new Error("막힘");
      },
      removeItem: () => {
        throw new Error("막힘");
      },
    };
    const item = createStoredValue({ storage: failing, key: "count", version: 1, parse: isCount });

    expect(item.read()).toBeNull();
    expect(() => item.write(7)).not.toThrow();
    expect(() => item.clear()).not.toThrow();
    expect(
      createStoredValue({ storage: null, key: "count", version: 1, parse: isCount }).read(),
    ).toBeNull();
  });
});
