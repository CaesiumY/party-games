/**
 * 브라우저 저장 도우미(스펙 「영속화」). 저장 항목(키)마다 따로 버전 번호를 두고,
 * 읽을 수 없거나 버전이 다른 항목은 그 키만 버린다. 다른 항목은 건드리지 않는다.
 * 최고 점수가 쓰고, 이어 하기(#10)·음소거(#12)도 같은 도우미로 항목을 하나씩 더한다.
 *
 * 저장 형식: `{"version": n, "value": ...}` 를 JSON 으로.
 */

/** localStorage 에서 쓰는 부분만. 테스트는 `memoryStorage()` 를 넣는다. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface StoredValue<T> {
  /** 저장된 값. 없거나, 읽을 수 없거나, 버전이 다르면 null(그 항목은 버린다). */
  read(): T | null;
  write(value: T): void;
  clear(): void;
}

export interface StoredValueOptions<T> {
  /** 브라우저 저장소. 쓸 수 없으면 null(언제나 비어 있는 것으로 다룬다). */
  storage: KeyValueStorage | null;
  key: string;
  /** 이 항목의 형식 버전. 형식을 바꾸면 올린다. 옛 버전의 값은 버려진다. */
  version: number;
  /** 저장된 값이 이 항목의 형식에 맞는지 확인한다. 맞지 않으면 null. */
  parse(value: unknown): T | null;
}

export function createStoredValue<T>({
  storage,
  key,
  version,
  parse,
}: StoredValueOptions<T>): StoredValue<T> {
  // 사생활 보호 모드 등에서 저장소 접근이 예외를 던져도 게임은 계속된다.
  const attempt = <R>(action: (s: KeyValueStorage) => R): R | null => {
    if (!storage) return null;
    try {
      return action(storage);
    } catch {
      return null;
    }
  };
  const clear = () => {
    attempt((s) => s.removeItem(key));
  };

  return {
    read() {
      const raw = attempt((s) => s.getItem(key));
      if (raw === null) return null;
      const value = decode(raw, version, parse);
      if (value === null) clear();
      return value;
    },
    write(value) {
      attempt((s) => s.setItem(key, JSON.stringify({ version, value })));
    },
    clear,
  };
}

function decode<T>(raw: string, version: number, parse: (value: unknown) => T | null): T | null {
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof stored !== "object" || stored === null) return null;
  if (!("version" in stored) || stored.version !== version || !("value" in stored)) return null;
  return parse(stored.value);
}

/** 이 브라우저의 localStorage. 접근조차 막혀 있으면 null. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** 메모리에만 두는 저장소. 테스트에서 브라우저 저장소 대신 넣는다. */
export function memoryStorage(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}
