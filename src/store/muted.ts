import { createStoredValue, type KeyValueStorage, type StoredValue } from "./stored-value";

/** 이 기기의 음소거 설정(스펙 「소리」·「영속화」). 켜져 있으면 효과음을 내지 않는다. */
export function mutedValue(storage: KeyValueStorage | null): StoredValue<boolean> {
  return createStoredValue({
    storage,
    key: "yacht.muted",
    version: 1,
    parse: (value) => (typeof value === "boolean" ? value : null),
  });
}
